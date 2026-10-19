-- Missions, weekend packs, a wishlist with alerts, and notifications read
-- one by one. Every number here must match lib/missions.ts and lib/packs.ts.

/* ---------- Notifications: per-card alerts, read one by one ---------- */

alter table public.notifications
  add column card_slug text references public.cards (slug) on delete cascade;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'trade_received', 'trade_accepted', 'trade_declined', 'trade_cancelled',
    'wish_shop', 'wish_used', 'wish_double'
  ));

create function public.mark_notification_read(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where id = p_id and user_id = (select auth.uid()) and read_at is null;
$$;

/* ---------- Wishlist: cars a player is looking for ---------- */

-- Public, like collections: other players see what you look for.
create table public.wishes (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_slug text not null references public.cards (slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, card_slug)
);

create index wishes_card_idx on public.wishes (card_slug);

alter table public.wishes enable row level security;
create policy "Wishes are public" on public.wishes for select to anon, authenticated using (true);

-- Up to 60 cars, never one the player already holds.
create function public.set_wish(p_slug text, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not p_on then
    delete from public.wishes where user_id = uid and card_slug = p_slug;
    return;
  end if;

  if not exists (select 1 from public.cards where slug = p_slug) then
    raise exception 'unknown card';
  end if;
  if exists (select 1 from public.card_copies where owner_id = uid and card_slug = p_slug) then
    raise exception 'already owned';
  end if;
  if (select count(*) from public.wishes where user_id = uid) >= 60 then
    raise exception 'too many wishes';
  end if;
  insert into public.wishes (user_id, card_slug) values (uid, p_slug) on conflict do nothing;
end;
$$;

-- One unread alert per player, car and kind: a busy car never floods the bell.
create function public.notify_wishers(p_slug text, p_kind text, p_actor uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, actor_id, card_slug)
  select w.user_id, p_kind, p_actor, p_slug
  from public.wishes w
  where w.card_slug = p_slug
    and w.user_id is distinct from p_actor
    and not exists (
      select 1 from public.notifications n
      where n.user_id = w.user_id and n.kind = p_kind and n.card_slug = p_slug and n.read_at is null
    );
$$;

-- A copy changes hands: the new owner's wish is granted, and when they now
-- hold a duplicate, whoever looks for the car hears about it.
create function public.on_copy_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is null then
    return null;
  end if;
  delete from public.wishes where user_id = new.owner_id and card_slug = new.card_slug;
  if (select count(*) from public.card_copies where owner_id = new.owner_id and card_slug = new.card_slug) >= 2 then
    perform public.notify_wishers(new.card_slug, 'wish_double', new.owner_id);
  end if;
  return null;
end;
$$;

create trigger card_copies_owner_wishes
  after insert or update of owner_id on public.card_copies
  for each row execute function public.on_copy_owner();

create function public.on_shop_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_wishers(c.card_slug, 'wish_used', null)
  from public.card_copies c where c.id = new.copy_id;
  return null;
end;
$$;

create trigger shop_stock_wishes
  after insert on public.shop_stock
  for each row execute function public.on_shop_stock();

create function public.on_shop_offer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_wishers(new.card_slug, 'wish_shop', null);
  return null;
end;
$$;

create trigger shop_offers_wishes
  after insert on public.shop_offers
  for each row execute function public.on_shop_offer();

/* ---------- Weekend packs: one themed pack, Friday to Sunday ---------- */

-- rotation: the pack's turn among weekend packs (ISO week modulo their
-- count); null for packs always on sale. Must match lib/packs.ts.
alter table public.packs add column rotation smallint unique;

insert into public.packs (id, name, themes, free, price, slots, theme_share, rotation) values
  ('annees-80', 'Années 80', '{decennie-1980}', true, 200,
    '[{"n":4,"odds":[60,28,9,3]},{"n":1,"odds":[0,75,19,6]}]', 0.8, 0),
  ('rideau-de-fer', 'Rideau de fer', '{Est}', true, 200,
    '[{"n":4,"odds":[60,28,9,3]},{"n":1,"odds":[0,75,19,6]}]', 0.8, 1),
  ('annees-90', 'Années 90', '{decennie-1990}', true, 200,
    '[{"n":4,"odds":[60,28,9,3]},{"n":1,"odds":[0,75,19,6]}]', 0.8, 2),
  ('salon-de-luxe', 'Salon de luxe', '{luxe}', true, 200,
    '[{"n":4,"odds":[60,28,9,3]},{"n":1,"odds":[0,75,19,6]}]', 0.8, 3),
  ('annees-2000', 'Années 2000', '{decennie-2000}', true, 200,
    '[{"n":4,"odds":[60,28,9,3]},{"n":1,"odds":[0,75,19,6]}]', 0.8, 4);

-- The weekend pack on sale now (Friday 00:00 to Monday 00:00, Paris), or null.
create function public.weekend_pack()
returns text
language sql
stable
set search_path = ''
as $$
  select p.id
  from public.packs p
  where extract(isodow from now() at time zone 'Europe/Paris') >= 5
    and p.rotation = extract(week from now() at time zone 'Europe/Paris')::int
                     % (select count(*) from public.packs where rotation is not null);
$$;

/* ---------- Launch decade as a trait (scripts/cars/build-cards.mjs) ---------- */

update public.cards set traits = array_append(traits, 'decennie-1880')
where not ('decennie-1880' = any (traits)) and slug in (
  'benz-patent-motorwagen',
  'peugeot-type-1'
);

update public.cards set traits = array_append(traits, 'decennie-1890')
where not ('decennie-1890' = any (traits)) and slug in (
  'fiat-3-hp',
  'ford-quadricycle',
  'peugeot-type-4',
  'peugeot-type-3',
  'peugeot-type-5',
  'peugeot-type-10',
  'peugeot-type-2',
  'benz-velo',
  'la-jamais-contente',
  'prasident'
);

update public.cards set traits = array_append(traits, 'decennie-1900')
where not ('decennie-1900' = any (traits)) and slug in (
  'fiat-12-hp',
  'lancia-alfa',
  'rolls-royce-10-hp',
  'blitzen-benz',
  'fiat-6-hp',
  'fiat-8-hp',
  'rolls-royce-v-8',
  'ford-a',
  'ford-model-f',
  'fiat-16-20-hp',
  'fiat-24-32-hp',
  'ford-b',
  'fiat-60-hp',
  'fiat-brevetti',
  'peugeot-type-81',
  'peugeot-type-69',
  'rolls-royce-silver-ghost',
  'ford-model-n',
  'fiat-type-1',
  'oldsmobile-curved-dash',
  'ford-model-c',
  'fiat-10-hp',
  'mercedes-simplex',
  'ford-model-k'
);

update public.cards set traits = array_append(traits, 'decennie-1910')
where not ('decennie-1910' = any (traits)) and slug in (
  'alfa-romeo-40-60-hp',
  'fiat-s76-record',
  'alfa-romeo-24-hp',
  'fiat-type-zero',
  'alfa-romeo-20-30-hp',
  'lancia-kappa-1',
  'fiat-70',
  'lancia-gamma-20hp',
  'lancia-theta',
  'hispano-suiza-h6',
  'lancia-epsilon',
  'citroen-type-a',
  'fiat-505',
  'fiat-501',
  'fiat-type-2',
  'mitsubishi-model-a',
  'ford-model-tt',
  'tatra-10'
);

update public.cards set traits = array_append(traits, 'decennie-1920')
where not ('decennie-1920' = any (traits)) and slug in (
  'bugatti-type-41',
  'alfa-romeo-g1-g2',
  'rumpler-tropfenwagen',
  'fiat-520',
  'alfa-romeo-p1',
  'rolls-royce-phantom-ii',
  'rolls-royce-phantom-i',
  'bugatti-type-35',
  'bentley-3-litre-q2439434',
  'volvo-ov4',
  'alfa-romeo-6c',
  'alfa-romeo-rm',
  'alfa-romeo-rl',
  'rolls-royce-20-hp',
  'fiat-525',
  'duesenberg-model-a',
  'fiat-507',
  'fiat-512',
  'lancia-dilambda',
  'fiat-519',
  'ford-model-a',
  'lancia-lambda',
  'fiat-509',
  'citroen-type-c',
  'peugeot-201',
  'fiat-502',
  'fiat-503',
  'fiat-521',
  'fiat-514',
  'peugeot-type-190',
  'fiat-510',
  'renault-nn',
  'opel-4-ps',
  'renault-mt',
  'austin-7',
  'bmw-3-15',
  'renault-monasix',
  'renault-kj'
);

update public.cards set traits = array_append(traits, 'decennie-1930')
where not ('decennie-1930' = any (traits)) and slug in (
  'mercedes-benz-t80',
  'bugatti-type-55',
  'mercedes-benz-w-31',
  'bentley-8-litre',
  'bentley-mark-v',
  'alfa-romeo-tipo-a',
  'bugatti-type-57',
  'bmw-328',
  'tatra-87',
  'gaz-61',
  'rolls-royce-phantom-iii',
  'rolls-royce-wraith',
  'fiat-2800',
  'lancia-astura',
  'bentley-3-litre',
  'ss-jaguar-100',
  'peugeot-601',
  'fiat-515',
  'ss1',
  'audi-front',
  'fiat-527',
  'citroen-tub',
  'rolls-royce-25-30',
  'bmw-320',
  'citroen-traction-avant',
  'chevrolet-suburban',
  'lincoln-continental',
  'fiat-500-topolino',
  'ford-anglia',
  'ford-taunus',
  'fiat-508-balilla',
  'ford-model-b',
  'opel-olympia',
  'opel-kapitan',
  'mercedes-benz-type-136',
  'lancia-aprilia',
  'fiat-1500',
  'ford-prefect',
  'lancia-ardea',
  'ford-v8-1932',
  'chrysler-airflow',
  'lancia-augusta',
  'ford-eifel',
  'jaguar-mark-iv',
  'fiat-524',
  'gaz-m1',
  'peugeot-402',
  'fiat-522',
  'peugeot-302',
  'lancia-artena',
  'gaz-a',
  'peugeot-401',
  'bmw-326',
  'citroen-rosalie',
  'fiat-518-ardita',
  'renault-celtaquatre',
  'dkw-f7',
  'simca-8',
  'tatra-97',
  'opel-admiral',
  'mercedes-260-d',
  'renault-juvaquatre',
  'lincoln-zephyr',
  'buick-roadmaster',
  'toyota-aa',
  'skoda-superb-1934-1949',
  'ford-model-y',
  '1930-cabriolet-v-16',
  'volvo-pv-36-carioca',
  'ford-model-c-ten',
  'ford-7y',
  'bmw-3-20',
  'alfa-romeo-12c',
  'dymaxion-car',
  'zis-101',
  'renault-monaquatre',
  'dkw-f8',
  'opel-super-6',
  'volvo-pv51',
  'mercedes-benz-w24'
);

update public.cards set traits = array_append(traits, 'decennie-1940')
where not ('decennie-1940' = any (traits)) and slug in (
  'tucker-48',
  'skoda-vos',
  'ferrari-166-inter',
  'maserati-a6',
  'auto-avio-costruzioni-815',
  'zis-110',
  'rolls-royce-silver-dawn',
  'lagonda-2-6-litre',
  'ac-2-litre',
  'citroen-2-cv',
  'porsche-356',
  'volkswagen-kubelwagen',
  'gaz-pobieda',
  'chevrolet-bel-air',
  'renault-4cv',
  'jaguar-xk120',
  'morris-minor',
  'saab-92',
  'gaz-67',
  'tatra-600',
  'ford-vedette',
  'jaguar-mark-v',
  'ford-gpa',
  'ford-pilot',
  'panhard-dyna-x',
  'dkw-schnellaster',
  'bentley-mark-vi',
  'skoda-1101-1102',
  'moskvitch-400-401',
  'citroen-type-h',
  'volvo-pv444',
  'piaggio-ape',
  'gaz-64',
  'jeep-cj',
  'volkswagen-combi',
  'rolls-royce-silver-wraith',
  'willys-jeepster',
  'oldsmobile-98',
  'dodge-coronet',
  'ford-1949',
  'willys-jeep-station-wagon',
  'land-rover-series',
  'jeep-willys-truck',
  'cadillac-series-62',
  'borgward-hansa-1500',
  'volkswagen-type-2-t2',
  'ford-de-1941'
);

update public.cards set traits = array_append(traits, 'decennie-1950')
where not ('decennie-1950' = any (traits)) and slug in (
  'porsche-550',
  'rolls-royce-phantom-iv',
  'bugatti-type-101',
  'fiat-8v',
  'zil-111',
  'jaguar-c-type',
  'ferrari-195',
  'ferrari-212',
  'maserati-5000-gt',
  'volvo-p1900',
  'jaguar-xkss',
  'tvr-grantura',
  'mercedes-benz-300-sl',
  'bmw-507',
  'rolls-royce-silver-cloud',
  'rolls-royce-phantom-v',
  'lotus-elite-14',
  'maserati-3500-gt',
  'bmw-503',
  'ac-ace',
  'alfa-romeo-ar51-matta',
  'bentley-s1',
  'horch-sachsenring-p240',
  'bentley-s2',
  'bentley-r-type',
  'alpine-a108',
  'alpine-a106',
  'citroen-ds',
  'mini',
  'toyota-land-cruiser',
  'fiat-500',
  'nissan-skyline',
  'gaz-69',
  'renault-dauphine',
  'ferrari-250',
  'isetta',
  'peugeot-403',
  'toyota-corona',
  'toyota-crown',
  'uaz-452',
  'ford-galaxie',
  'mercedes-benz-type-120',
  'lancia-flaminia',
  'saab-93',
  'mercedes-benz-190-sl',
  'goggomobil',
  'alfa-romeo-1900',
  'volkswagen-karmann-ghia',
  'tatra-603',
  'alfa-romeo-giulietta',
  'bmw-600',
  'fiat-1800-2100',
  'lotus-seven',
  'buick-electra',
  'renault-floride-et-caravelle',
  'hudson-hornet',
  'alfa-romeo-2000',
  'fiat-campagnola',
  'jaguar-xk150',
  'skoda-440',
  'alfa-romeo-romeo',
  'jaguar-mark-ix',
  'lancia-aurelia',
  'ferrari-america',
  'mercedes-benz-type-180',
  'jaguar-xk140',
  'daf-600',
  'seat-1400',
  'saab-95',
  'jaguar-mark-vii',
  'lancia-appia',
  'jaguar-mark-viii',
  'panhard-dyna-z',
  'ifa-f9',
  'austin-healey-100',
  'gaz-12-zim',
  'austin-healey-sprite',
  'mg-a',
  'ac-aceca',
  'moskvitch-402',
  'wartburg-311-312',
  'skoda-1200-1201-1202',
  'haflinger',
  'austin-healey-3000',
  'austin-fx4',
  'willys-aero',
  'zwickau-p70',
  'austin-cambridge',
  'renault-colorale',
  'vespa-400',
  'mercedes-benz-w-187',
  'chevrolet-corvette-c1',
  'cadillac-eldorado',
  'ford-zephyr',
  'hindustan-ambassador',
  'cadillac-deville',
  'fiat-1100',
  'dodge-dart',
  'gaz-21',
  'subaru-360',
  'bmw-700',
  'mercedes-benz-type-111',
  'chevrolet-corvair',
  'nissan-bluebird',
  'plymouth-fury',
  'seat-600',
  'renault-fregate',
  'skoda-octavia-de-1959',
  'autobianchi-bianchina',
  'simca-aronde',
  'renault-estafette',
  'raf-977',
  'ford-courier',
  'gaz-13',
  'ford-fairlane',
  'fiat-1400',
  'nsu-prinz',
  'subaru-1500',
  'chevrolet-c-k',
  'rover-p5',
  'triumph-herald',
  'bmw-501',
  'nissan-gloria',
  'daihatsu-midget',
  'ford-consul',
  'chevrolet-biscayne',
  'ford-popular',
  'henry-j',
  'gaz-46',
  'plymouth-belvedere',
  'borgward-isabella',
  'chevrolet-210',
  'chevrolet-nomad',
  'ford-falcon',
  'pontiac-bonneville',
  'ford-ranchero',
  'vauxhall-victor',
  'chevrolet-150',
  'auto-union-1000',
  'dkw-f89',
  'dkw-3-6',
  'mercury-monterey',
  'jeep-forward-control',
  'austin-a30',
  'dodge-lancer',
  'dkw-munga',
  'porsche-597',
  'bedford-ca',
  'messerschmitt-kr-175',
  'reliant-regal',
  'suzuki-suzulight',
  'innocenti-a-40',
  'fiat-1200',
  'dongfeng-ca71'
);

update public.cards set traits = array_append(traits, 'decennie-1960')
where not ('decennie-1960' = any (traits)) and slug in (
  'ferrari-250-gto',
  'lamborghini-350-gt',
  'peel-p50',
  'porsche-904',
  'alfa-romeo-giulia-gta',
  'alfa-romeo-33-stradale',
  'de-tomaso-vallelunga',
  'alfa-romeo-carabo',
  'zil-114-117',
  'porsche-906',
  'lagonda-rapide',
  'peel-trident',
  'alfa-romeo-giulia-tz',
  'nissan-prince-royal',
  'jaguar-xj13',
  'lamborghini-espada',
  'toyota-2000-gt',
  'mercedes-benz-w100',
  'ferrari-365-daytona',
  'ac-cobra',
  'rolls-royce-phantom-vi',
  'maserati-ghibli-i',
  'citroen-m35',
  'bmw-3200-cs',
  'de-tomaso-mangusta',
  'maserati-mistral',
  'toyota-sports-800',
  'maserati-indy',
  'studebaker-avanti',
  'ferrari-365',
  'nsu-spider',
  'maserati-mexico',
  'iso-grifo',
  'honda-s500',
  'jensen-ff',
  'autobianchi-stellina',
  'maserati-sebring',
  'glas-v8',
  'triumph-tr5',
  'renault-4',
  'ford-transit',
  'fiat-124',
  'audi-80',
  'audi-100',
  'citroen-dyane',
  'mitsubishi-galant',
  'jaguar-type-e',
  'peugeot-404',
  'alfa-romeo-spider',
  'renault-16',
  'porsche-912',
  'porsche-914',
  'ford-capri',
  'alfa-romeo-giulia',
  'opel-commodore',
  'fiat-1300-1500',
  'ford-bronco',
  'simca-1000',
  'fiat-125',
  'citroen-mehari',
  'toyota-hiace',
  'citroen-ami-6',
  'nissan-sunny',
  'chevrolet-monte-carlo',
  'simca-1100',
  'renault-8-et-10',
  'mitsubishi-colt',
  'fiat-850',
  'plymouth-barracuda',
  'skoda-100-110',
  'opel-gt',
  'nsu-ro80',
  'ford-torino',
  'alpine-a110',
  'fiat-130',
  'nissan-300zx',
  'rolls-royce-silver-shadow',
  'alfa-romeo-1750',
  'bmw-e9',
  'mercedes-benz-w113',
  'alfa-romeo-2600',
  'lancia-flavia',
  'oldsmobile-cutlass',
  'mazda-r360',
  'jaguar-mark-x',
  'fiat-dino',
  'jaguar-s-type-q1291757',
  'dodge-super-bee',
  'fiat-124-sport-spider',
  'mg-mgb',
  'autobianchi-primula',
  'volkswagen-181',
  'mini-moke',
  'volvo-164',
  'daf-33',
  'triumph-spitfire',
  'autobianchi-a111',
  'dkw-f102',
  'mazda-cosmo',
  'honda-s800',
  'jensen-interceptor',
  'triumph-tr6',
  'plymouth-gtx',
  'triumph-gt6',
  'porsche-908',
  'ferrari-330',
  'mg-midget',
  '1963-1989-porsche-911',
  'nissan-s30',
  'fiat-2300',
  'ika-torino',
  'volkswagen-type-147-kleinlieferwagen',
  'seat-1500',
  'dacia-1100',
  'amc-hornet',
  'triumph-tr4',
  'ford-consul-classic',
  'honda-s600',
  'oldsmobile-442',
  'morgan-plus-8',
  'isuzu-117-coupe',
  'alfa-romeo-giulia-gt',
  'chevrolet-camaro-premiere-generation',
  'shanghai-sh760',
  'daf-daffodil',
  'peugeot-304',
  'lancia-fulvia',
  'mercedes-benz-w110',
  'audi-60',
  'volvo-145',
  'renault-6',
  'mazda-323',
  'autobianchi-a112',
  'chevrolet-chevelle',
  'saab-96',
  'skoda-1000-mb',
  'volkswagen-type-3',
  'toyota-cressida',
  'dacia-1300',
  'mitsubishi-delica',
  'bmc-ado17',
  'ford-e-series',
  'fiat-125p',
  'opel-diplomat',
  'saab-99',
  'toyota-publica',
  'mercedes-benz-type-112',
  'mercedes-benz-types-108-109',
  'chevrolet-van',
  'ford-falcon-q1363870',
  'moskvitch-408',
  'moskvitch-412',
  'oldsmobile-toronado',
  'nissan-laurel',
  'nissan-caravan',
  'austin-maxi',
  'rover-p6',
  'mazda-familia',
  'toyota-mark-ii',
  'pontiac-tempest',
  'subaru-r-2',
  'wartburg-353',
  'zastava-750',
  'trabant-601',
  'ford-maverick',
  'amc-javelin',
  'bmw-e3',
  'honda-n360',
  'pontiac-grand-prix',
  'ford-corsair',
  'daf-55',
  'plymouth-road-runner',
  'mazda-bongo',
  'bedford-cf',
  'nissan-president',
  'subaru-1000',
  'mazda-serie-b',
  'daf-44',
  'subaru-sambar',
  'daewoo-damas',
  'seat-1430',
  'simca-1300-1500',
  'triumph-2000',
  'renault-10',
  'pontiac-lemans',
  'dodge-a100',
  'skoda-1203',
  'honda-1300',
  'plymouth-duster',
  'fiat-241',
  'austin-3-litre',
  'bentley-t-series',
  'porsche-907',
  'mazda-carol',
  'bentley-s3',
  'peugeot-j7',
  'daihatsu-compagno',
  'mitsubishi-debonair',
  'mazda-luce',
  'suzuki-fronte',
  'mazda-porter',
  'mitsubishi-500',
  'ford-corcel',
  'mercury-marquis',
  'cadillac-calais',
  'checker-marathon',
  'isuzu-bellett',
  'honda-t360',
  'hillman-imp',
  'porsche-910',
  'buick-wildcat',
  'jeepster-commando',
  'international-harvester-scout',
  'hongqi-ca770'
);

update public.cards set traits = array_append(traits, 'decennie-1970')
where not ('decennie-1970' = any (traits)) and slug in (
  'lamborghini-silhouette',
  'lamborghini-cheetah',
  'maserati-kyalami',
  'ferrari-modulo',
  'lamborghini-countach',
  'bmw-m1',
  'lancia-stratos',
  'lamborghini-urraco',
  'lamborghini-jarama',
  'alfa-romeo-montreal',
  'ferrari-berlinetta-boxer',
  'rolls-royce-camargue',
  'ferrari-308-gt4',
  'maserati-khamsin',
  'bricklin-sv-1',
  'maserati-merak',
  'mazda-roadpacer-ap',
  'bond-bug',
  'de-tomaso-deauville',
  'de-tomaso-longchamp',
  'lada-2101-2102',
  'lada-niva',
  'fiat-126',
  'renault-5',
  'mazda-rx-7',
  'porsche-924',
  'mitsubishi-l200',
  'porsche-928',
  'honda-prelude',
  'fiat-127',
  'suzuki-jimny',
  'lancia-delta',
  'opel-manta',
  'ford-pinto',
  'citroen-visa',
  'citroen-gs-et-gsa',
  'bmw-e21',
  'mercedes-benz-w123',
  'peugeot-104',
  'opel-senator',
  'citroen-cx',
  'ford-granada',
  'peugeot-505',
  'saab-900',
  'uaz-469',
  'lada-2103-2106',
  'audi-50',
  'renault-20',
  'citroen-sm',
  'volvo-240',
  'fiat-132',
  'alfa-romeo-alfa-6',
  'renault-18',
  'jaguar-xjs',
  'fiat-131',
  'peugeot-604',
  'toyota-starlet',
  'alfa-romeo-alfasud',
  'ferrari-308',
  'zastava-skala',
  'hyundai-pony',
  'renault-7',
  'toyota-tercel',
  'alfa-romeo-giulietta-q719600',
  'alfa-romeo-alfetta',
  'fiat-ritmo',
  'suzuki-alto',
  'buick-regal',
  'opel-monza',
  'peugeot-305',
  'mercedes-benz-type-116',
  'fiat-x1-9',
  'lancia-beta',
  'lotus-esprit',
  'lancia-gamma',
  'renault-15-et-17',
  'de-tomaso-pantera',
  'mercedes-benz-type-107',
  'volvo-66',
  'dodge-ram-van',
  'matra-simca-rancho',
  'matra-simca-bagheera',
  'lancia-beta-montecarlo',
  'daf-66',
  'tatra-613',
  'plymouth-superbird',
  'alfa-romeo-sprint',
  'seat-1200-sport',
  'honda-z',
  'citroen-c35',
  'dodge-st-regis',
  'lancia-2000',
  'lotus-eclat',
  'alpine-a310',
  'renault-rodeo',
  'nissan-280z',
  'daf-46',
  'skoda-110-r',
  'seat-132',
  'citroen-ln-et-lna',
  'fso-polonez',
  'simca-talbot-horizon',
  'skoda-742',
  'renault-14',
  'simca-chrysler-160-180-2-litres-1610',
  'subaru-leone',
  'bmw-e23',
  'rover-sd1',
  'toyota-carina',
  'amc-pacer',
  'simca-chrysler-1307-1308-1309',
  'vw-k70',
  'gaz-24',
  'nissan-pulsar',
  'vaz-2106',
  'cadillac-seville',
  'mazda-626',
  'daihatsu-charade',
  'mazda-929',
  'morris-marina',
  'ford-ltd-crown-victoria',
  'mitsubishi-mirage',
  'chevrolet-vega',
  'fiat-242',
  'dodge-aspen',
  'austin-allegro',
  'seat-133',
  'chrysler-sunbeam',
  'dodge-magnum',
  'isuzu-faster',
  'subaru-rex',
  'daihatsu-taft',
  'volkswagen-transporter-t3',
  'toyota-lite-ace',
  'cadillac-fleetwood',
  'hyundai-porter',
  'amc-matador',
  'citroen-nemo',
  'datsun-cherry',
  'chevrolet-citation',
  'isuzu-gemini',
  'vauxhall-chevette',
  'nissan-vanette',
  'volkswagen-brasilia',
  'vaz-2102',
  'hillman-avenger',
  'chevrolet-monza',
  'ford-elite',
  'toyota-chaser',
  'honda-civic-hybrid',
  'honda-acty',
  'volkswagen-derby',
  'citroen-acadiane',
  'nissan-stanza',
  'mazda-capella',
  'moskvitch-2138-2140',
  'chevrolet-chevette',
  'daihatsu-charmant',
  'dodge-diplomat',
  'dodge-omni',
  'dodge-ramcharger',
  'amc-spirit',
  'zil-4104',
  'triumph-dolomite',
  'toyota-kijang',
  'subaru-brat',
  'dacia-pick-up',
  'dodge-colt',
  'fiat-850t-900t',
  'amc-eagle',
  'ford-fairmont',
  'leyland-princess',
  'plymouth-gran-fury',
  'fiat-147',
  'honda-life',
  'fiat-marengo'
);

update public.cards set traits = array_append(traits, 'decennie-1980')
where not ('decennie-1980' = any (traits)) and slug in (
  'ford-rs200',
  'lancia-delta-s4',
  'ferrari-mythos',
  'ruf-ctr',
  'ferrari-f40',
  'delorean-dmc-12',
  'ferrari-288-gto',
  'lamborghini-jalpa',
  'lamborghini-lm002',
  'porsche-959',
  'zil-41047',
  'ferrari-mondial',
  'alpine-a610',
  'maserati-karif',
  'renault-5-turbo',
  'peugeot-205',
  'opel-calibra',
  'audi-quattro',
  'bmw-m5',
  'renault-25',
  'suzuki-swift',
  'bmw-z4',
  'hyundai-sonata',
  'renault-21',
  'mercedes-benz-type-201',
  'bmw-e30',
  'porsche-944',
  'zastava-koral',
  'ford-sierra',
  'audi-v8',
  'peugeot-405',
  'ferrari-testarossa',
  'alfa-romeo-164',
  'citroen-xm',
  'fiat-tipo',
  'ford-taurus',
  'opel-combo',
  'fiat-ducato',
  'peugeot-605',
  'volkswagen-corrado',
  'jeep-wrangler',
  'ford-scorpio',
  'chrysler-voyager',
  'dodge-ram',
  'saab-9000',
  'subaru-legacy',
  'citroen-ax',
  'suzuki-escudo',
  'lada-samara',
  'alfa-romeo-75',
  'daewoo-nexia',
  'lincoln-town-car',
  'mazda-mx-5',
  'mitsubishi-eclipse',
  'citroen-bx',
  'lexus-ls',
  'honda-city',
  'alfa-romeo-33',
  'ferrari-348',
  'lancia-dedra',
  'nissan-maxima',
  'ford-orion',
  'ford-probe',
  'lancia-prisma',
  'skoda-favorit',
  'alfa-romeo-90',
  'lancia-y10',
  'bmw-e32',
  'peugeot-309',
  'nissan-300zx-q13218302',
  'moskvitch-2141-aleko',
  'bmw-z1',
  'citroen-axel',
  'talbot-tagora',
  'cadillac-allante',
  'saab-90',
  'alfa-romeo-arna',
  'mazda-mx-6',
  'ferrari-328',
  'subaru-xt',
  'yugo-florida',
  'mitsubishi-starion',
  'pontiac-fiero',
  'porsche-964',
  'volvo-480',
  'dacia-lastun',
  'isuzu-trooper',
  'maserati-biturbo',
  'fiat-argenta',
  'cadillac-cimarron',
  'honda-cr-x',
  'toyota-soarer',
  'talbot-matra-murena',
  'isuzu-piazza',
  'nissan-be-1',
  'buick-reatta',
  'lancia-trevi',
  'rolls-royce-silver-spirit',
  'dodge-400',
  'dodge-daytona',
  'austin-ambassador',
  'chevrolet-beretta',
  'chevrolet-corvette-c4',
  'renault-premier',
  'bentley-turbo-r',
  'piece-pour-s-cargo-moteur-chauffrette',
  'nissan-180sx',
  'bmw-z',
  'chevrolet-camaro-troisieme-generation',
  'acura-integra',
  'chevrolet-cavalier',
  'nissan-sentra',
  'citroen-c15',
  'austin-metro',
  'toyota-4-runner',
  'fiat-regata',
  'toyota-ae86',
  'ford-laser',
  'honda-legend',
  'hyundai-stellar',
  'hyundai-excel',
  'lexus-es',
  'oka',
  'daihatsu-applause',
  'hyundai-grandeur',
  'fiat-duna',
  'toyota-land-cruiser-prado',
  'cadillac-brougham',
  'volkswagen-golf-ii',
  'dodge-dakota',
  'rover-800',
  'ford-escort',
  'talbot-samba',
  'seat-malaga',
  'chevrolet-lumina',
  'seat-marbella',
  'dodge-caravan',
  'chevrolet-s-10-blazer',
  'volkswagen-santana',
  'mazda-mpv',
  'chevrolet-astro',
  'citroen-jumper',
  'ford-tempo',
  'mitsubishi-space-wagon',
  'mercedes-benz-mb100',
  'infiniti-i',
  'infiniti-q45',
  'volvo-440-460',
  'austin-maestro',
  'ford-ranger-usa',
  'suzuki-forsa',
  'renault-9-et-11',
  'ford-aerostar',
  'kia-bongo',
  'maruti-800',
  'honda-today',
  'renault-express-i',
  'volkswagen-taro',
  'seat-fura',
  'jeep-comanche',
  'daihatsu-rocky',
  'chevrolet-corsica',
  'ford-festiva',
  'dodge-600',
  'dodge-dynasty',
  'skoda-rapid',
  'proton-saga',
  'nissan-prairie',
  'austin-montego',
  'mitsubishi-tredia',
  'peugeot-boxer',
  'mercury-sable',
  'pontiac-trans-sport',
  'chevrolet-celebrity',
  'daihatsu-cuore',
  'nissan-primastar',
  'kia-concord',
  'citroen-c25',
  'ford-bronco-ii',
  'toyota-cresta',
  'mitsubishi-cordia',
  'chevrolet-s-10',
  'wartburg-1-3',
  'ford-sierra-rs-cosworth',
  'ford-del-rey',
  'volvo-700-series',
  'dodge-shadow',
  'dodge-aries',
  'dodge-spirit',
  'acura-vigor',
  'skoda-garde',
  'morris-ital',
  'volvo-740',
  'holden-barina',
  'subaru-sumo',
  'aro-10',
  'nissan-terrano',
  'ford-telstar',
  'mercury-lynx',
  'ford-exp',
  'volkswagen-passat-b3',
  'nissan-leopard',
  'oldsmobile-cutlass-calais',
  'oldsmobile-silhouette',
  'daihatsu-leeza',
  'honda-quint',
  'gaz-3102',
  'renault-alaskan'
);

update public.cards set traits = array_append(traits, 'decennie-1990')
where not ('decennie-1990' = any (traits)) and slug in (
  'mclaren-f1',
  'pagani-zonda',
  'bugatti-eb110',
  'de-tomaso-guara',
  'tatra-700',
  'bugatti-eb218',
  'bmw-nazca-c2',
  'cizeta-moroder-v16t',
  'jaguar-xjr-15',
  'tvr-cerbera-speed-12',
  'aston-martin-db-ar1',
  'lamborghini-diablo',
  'ferrari-360-modena',
  'dodge-viper',
  'ferrari-f50',
  'jaguar-xj220',
  'ferrari-550-maranello',
  'audi-rs2',
  'ferrari-456',
  'maserati-3200-gt',
  'lotus-carlton',
  'bentley-azure',
  'renault-spider',
  'rolls-royce-silver-seraph',
  'toyota-mega-cruiser',
  'bentley-continental-r',
  'tvr-cerbera',
  'maserati-shamal',
  'autozam-az-1',
  'gmc-typhoon',
  'rolls-royce-corniche-q2674754',
  'gmc-syclone',
  'toyota-rav4',
  'skoda-octavia',
  'audi-a8',
  'ford-mondeo',
  'audi-tt',
  'bmw-x5-q796778',
  'subaru-impreza',
  'audi-a2',
  'volkswagen-new-beetle',
  'citroen-xsara',
  'cadillac-escalade',
  'kia-rio',
  'honda-cr-v',
  'peugeot-406',
  'kia-sportage',
  'peugeot-106',
  'seat-leon',
  'hyundai-elantra',
  'citroen-berlingo',
  'toyota-avensis',
  'ford-ka',
  'ford-crown-victoria',
  'peugeot-607',
  'honda-nsx',
  'bmw-e46',
  'alfa-romeo-155',
  'alfa-romeo-156',
  'ferrari-f355',
  'chevrolet-silverado',
  'citroen-zx',
  'skoda-felicia',
  'lexus-rx',
  'volkswagen-lupo',
  'nissan-primera',
  'smart-fortwo',
  'ford-galaxy',
  'mercedes-benz-ml',
  'honda-s2000',
  'saab-9-5',
  'peugeot-306',
  'fiat-multipla',
  'honda-hr-v',
  'bmw-z3',
  'citroen-xantia',
  'fiat-coupe',
  'chevrolet-spark',
  'ford-explorer',
  'bmw-z8',
  'citroen-saxo',
  'porsche-968',
  'saab-9-3',
  'volvo-850',
  'seat-arosa',
  'seat-cordoba',
  'opel-tigra',
  'lexus-is',
  'land-rover-freelander',
  'lotus-elise',
  'bmw-e38',
  'daewoo-lanos',
  'mitsubishi-pajero-sport',
  'mercedes-benz-type-140',
  'citroen-xsara-picasso',
  'seat-toledo',
  'lancia-lybra',
  'subaru-forester',
  'mitsubishi-carisma',
  'toyota-tundra',
  'toyota-avalon',
  'hyundai-atos',
  'hyundai-coupe',
  'daewoo-leganza',
  'ford-puma',
  'toyota-previa',
  'alfa-romeo-166',
  'daihatsu-terios',
  'nissan-almera',
  'kia-carens',
  'lancia-kappa',
  'mercedes-benz-vito',
  'daewoo-matiz',
  'daewoo-espero',
  'audi-rs4',
  'citroen-jumpy',
  'renault-safrane',
  'porsche-996',
  'chevrolet-express',
  'volvo-v70',
  'toyota-sienna',
  'tata-indica',
  'seat-alhambra',
  'hummer-h1',
  'fiat-bravo-q1359725',
  'hyundai-equus',
  'daewoo-nubira',
  'lincoln-navigator',
  'jaguar-s-type',
  'nissan-altima',
  'volvo-s40',
  'peugeot-partner',
  'jaguar-xk',
  'aston-martin-db7',
  'fiat-barchetta',
  'bmw-e31',
  'subaru-alcyone-svx',
  'mazda-mx-3',
  'porsche-993',
  'nissan-be-1-pao-s-cargo-et-figaro',
  'honda-beat',
  'plymouth-prowler',
  'mg-f',
  'dacia-nova',
  'nissan-100-nx',
  'cadillac-catera',
  'chevrolet-niva',
  'mercedes-benz-type-215',
  'tvr-griffith',
  'suzuki-cappuccino',
  'hyundai-scoupe',
  'mercedes-benz-type-170',
  'koenigsegg-cc',
  'ford-escort-rs-cosworth',
  'audi-s2',
  'acura-tl',
  'toyota-curren',
  'proton-tiara',
  'mitsubishi-fto',
  'lada-nadejda',
  'subaru-impreza-wrx',
  'chrysler-vision',
  'pontiac-sunfire',
  'subaru-impreza-wrx-sti',
  'ford-ikon',
  'toyota-sera',
  'proton-satria',
  'honda-del-sol',
  'proton-putra',
  'chevrolet-corvette-c5',
  'nissan-cube',
  'volkswagen-bora',
  'ford-excursion',
  'ford-cougar',
  'lexus-lx',
  'toyota-tacoma',
  'nissan-serena',
  'opel-sintra',
  'renault-symbol',
  'rover-75',
  'fiat-siena',
  'kia-sephia',
  'hyundai-trajet',
  'mitsubishi-space-star',
  'mazda-premacy',
  'toyota-paseo',
  'audi-s6',
  'bmw-x5',
  'lexus-sc',
  'seat-inca',
  'fiat-marea',
  'dodge-avenger',
  'volkswagen-golf-iv',
  'dodge-intrepid',
  'daewoo-tico',
  'subaru-outback',
  'gazelle',
  'bmw-serie-3-compact',
  'nissan-elgrand',
  'audi-s3',
  'chrysler-300m',
  'infiniti-g',
  'mercedes-benz-type-202',
  'bentley-arnage',
  'rover-400',
  'daihatsu-sirion',
  'proton-wira',
  'volkswagen-vento',
  'toyota-caldina',
  'rover-600',
  'volkswagen-golf-iii',
  'hyundai-satellite',
  'kia-credos',
  'mazda-demio',
  'suzuki-wagon-r',
  'nissan-quest',
  'mitsubishi-pajero-pinin',
  'mitsubishi-pajero-mini',
  'mercedes-benz-type-220',
  'audi-s8',
  'fiat-scudo',
  'toyota-comfort',
  'buick-park-avenue',
  'honda-logo',
  'suzuki-xl7',
  'dodge-stratus',
  'hyundai-dynasty',
  'nissan-terrano-ii',
  'ford-contour',
  'volvo-s70',
  'oldsmobile-intrigue',
  'nissan-x-terra',
  'subaru-vivio',
  'fiat-grande-punto',
  'chrysler-concorde',
  'kia-pregio',
  'hyundai-galloper',
  'subaru-pleo',
  'mazda-xedos-9',
  'suzuki-x-90',
  'oldsmobile-aurora',
  'toyota-yaris-verso',
  'volkswagen-transporter-t4',
  'mercedes-benz-type-203',
  'ssangyong-musso',
  'lincoln-ls',
  'ail-storm',
  'citroen-c8',
  'samsung-sm5',
  'gmc-envoy',
  'tata-sumo',
  'honda-odyssey',
  'honda-stepwgn',
  'toyota-camry-solara',
  'oldsmobile-alero',
  'buick-gl8',
  'chevrolet-venture',
  'tata-safari',
  'mercedes-benz-classe-gle',
  'pontiac-montana',
  'honda-domani',
  'hyundai-entourage',
  'kia-retona',
  'bugatti-eb18-3-chiron',
  'honda-crossroad',
  'nissan-avenir',
  'opel-astra-h',
  'saturn-s-series',
  'proton-persona',
  'xedos-6',
  'oldsmobile-bravada',
  'toyota-vitz',
  'ssangyong-chairman',
  'kia-joice',
  'volkswagen-polo-iii',
  'isuzu-panther',
  'holden-caprice',
  'nissan-frontier',
  'mitsubishi-pajero-junior',
  'alfa-romeo-scighera',
  'oldsmobile-achieva',
  'nissan-almera-tino',
  'chrysler-stratus',
  'fs-lublin',
  'honda-torneo',
  'mazda-sentia',
  'nissan-rasheen',
  'ford-versailles',
  'kia-shuma',
  'mercury-mountaineer',
  'honda-avancier',
  'nissan-presage',
  'nissan-presea',
  'honda-s-mx',
  'nissan-stagea',
  'opel-astra-f',
  'proton-perdana',
  'daihatsu-gran-move',
  'dacia-1325',
  'toyota-harrier',
  'suzuki-kei',
  'gaz-3110',
  'daihatsu-opti',
  'toyota-gaia',
  'mitsubishi-rvr',
  'toyota-avensis-verso',
  'mercedes-benz-classe-v'
);

update public.cards set traits = array_append(traits, 'decennie-2000')
where not ('decennie-2000' = any (traits)) and slug in (
  'lamborghini-reventon',
  'maserati-mc12',
  'koenigsegg-ccx',
  'gumpert-apollo',
  'koenigsegg-cc8s',
  'saleen-s7',
  'bentley-state-limousine',
  'zenvo-st1',
  'ariel-atom',
  'ascari-kz1',
  'bristol-fighter',
  'koenigsegg-ccxr',
  'tvr-tamora',
  'byd-f8',
  'mg-xpower-sv',
  'lamborghini-murcielago',
  'lamborghini-gallardo',
  'audi-r8',
  'ferrari-enzo',
  'mercedes-benz-slr-mclaren',
  'nissan-gt-r',
  'ferrari-458-italia',
  'ferrari-f430',
  'ferrari-california',
  'audi-a5',
  'ferrari-599-gtb-fiorano',
  'porsche-carrera-gt',
  'maybach-57-et-62',
  'ferrari-612-scaglietti',
  'alfa-romeo-8c-competizione',
  'ferrari-575m-maranello',
  'hyundai-genesis-coupe',
  'tvr-sagaris',
  'ktm-x-bow',
  'lotus-europa-s',
  'mitsuoka-orochi',
  'bentley-brooklands-q3638331',
  'tata-nano',
  'dacia-sandero',
  'audi-q7',
  'hyundai-tucson',
  'peugeot-308',
  'peugeot-307',
  'dacia-logan',
  'citroen-c1',
  'toyota-aygo',
  'honda-jazz',
  'skoda-yeti',
  'mazda-rx-8',
  'peugeot-207',
  'kia-picanto',
  'toyota-auris',
  'skoda-superb',
  'hyundai-i10',
  'kia-cee-d',
  'volkswagen-touran',
  'peugeot-407',
  'hyundai-i30',
  'hyundai-santa-fe',
  'ford-kuga',
  'citroen-c5',
  'kia-sorento',
  'ford-c-max',
  'volkswagen-eos',
  'alfa-romeo-147',
  'chrysler-pt-cruiser',
  'kia-soul',
  'peugeot-107',
  'alfa-romeo-159',
  'ford-s-max',
  'citroen-ds3',
  'mazda-3',
  'volvo-xc90',
  'ford-edge',
  'peugeot-3008',
  'alfa-romeo-mito',
  'volkswagen-phaeton',
  'chevrolet-captiva',
  'mazda-6',
  'maserati-granturismo',
  'bmw-x1',
  'opel-agila',
  'fiat-500-ii',
  'volkswagen-crafter',
  'ford-ecosport',
  'chrysler-300',
  'hyundai-matrix',
  'citroen-c2',
  'audi-rs6',
  'lada-kalina',
  'ford-fusion',
  'daewoo-lacetti',
  'peugeot-1007',
  'lada-priora',
  'aston-martin-db9',
  'bentley-continental-gt',
  'volkswagen-cc',
  'lancia-thesis',
  'mitsubishi-outlander',
  'citroen-c6',
  'volvo-s60',
  'opel-antara',
  'suzuki-sx4',
  'cadillac-cts',
  'nissan-note',
  'volvo-c30',
  'volkswagen-fox',
  'fiat-doblo',
  'fiat-stilo',
  'fiat-bravo',
  'hyundai-ix55',
  'skoda-roomster',
  'mercedes-benz-classe-glk',
  'aston-martin-vantage',
  'ssc-ultimate-aero',
  'citroen-c-crosser-peugeot-4007-mitsubishi-outlander-cuo',
  'seat-altea',
  'volvo-xc60',
  'peugeot-5008',
  'smart-forfour',
  'peugeot-rcz',
  'kia-cerato',
  'toyota-highlander',
  'hummer-h2',
  'rolls-royce-ghost',
  'mazda-2',
  'bentley-continental-flying-spur',
  'renault-vel-satis',
  'nissan-370z',
  'lamborghini-estoque',
  'cadillac-bls',
  'renault-fluence',
  'mercedes-benz-classe-gl',
  'alfa-romeo-gt',
  'mitsubishi-grandis',
  'mini-2001-2006',
  'chevrolet-epica',
  'aston-martin-dbs-v12',
  'mazda-cx-9',
  'bmw-e87',
  'maybach-exelero',
  'fiat-linea',
  'lotus-exige',
  'daewoo-rezzo',
  'chrysler-crossfire',
  'kia-venga',
  'buick-lacrosse',
  'nissan-tiida',
  'toyota-fortuner',
  'ford-transit-connect',
  'toyota-alphard',
  'opel-signum',
  'suzuki-splash',
  'citroen-c3-picasso',
  'jeep-compass',
  'lancia-musa',
  'porsche-997',
  'pontiac-solstice',
  'seat-exeo',
  'chevrolet-ssr',
  'cadillac-xlr',
  'lotus-evora',
  'opel-speedster',
  'pontiac-aztek',
  'citroen-c-crosser',
  'renault-avantime',
  'dacia-solenza',
  'smart-roadster',
  'mercedes-benz-vaneo',
  'bmw-e63',
  'dacia-supernova',
  'saab-9-7x',
  'daihatsu-copen',
  'pontiac-torrent',
  'spyker-c8',
  'gaz-volga-siber',
  'ascari-a10',
  'subaru-r1',
  'bmw-e85',
  'mercedes-benz-type-230',
  'saturn-outlook',
  'mercedes-benz-type-216',
  'citroen-c3-pluriel',
  'chevrolet-corvette-c6',
  'saturn-sky',
  'cadillac-cts-v',
  'morgan-aero-8',
  'marussia-b2',
  'mercedes-benz-type-171',
  'bmw-e89',
  'acura-rsx',
  'tramontana',
  'saturn-relay',
  'mg-zr',
  'dacia-logan-iii',
  'toyota-brevis',
  'ruf-rt-12-s',
  'ds-3-crossback',
  'chevrolet-equinox',
  'chevrolet-traverse',
  'renault-modus',
  'citroen-c4-picasso',
  'chevrolet-hhr',
  'jaguar-x-type',
  'hyundai-genesis',
  'hyundai-terracan',
  'fiat-idea',
  'suzuki-liana',
  'nissan-titan',
  'bmw-7-f01',
  'cadillac-sts',
  'ford-fusion-q920675',
  'suzuki-ignis',
  'volvo-v50',
  'nissan-murano',
  'mercedes-benz-type-211',
  'cadillac-dts',
  'dodge-caliber',
  'dodge-nitro',
  'dodge-journey',
  'kia-borrego',
  'honda-stream',
  'toyota-mark-x',
  'lexus-gx',
  'toyota-corolla-verso',
  'ford-flex',
  'samand',
  'bmw-e65',
  'toyota-avanza',
  'hummer-h3',
  'mazda-cx-7',
  'subaru-tribeca',
  'volkswagen-golf-v',
  'kia-forte',
  'bmw-serie-5-gran-turismo',
  'daewoo-magnus',
  'mazda-bt-50',
  'mercedes-benz-type-212',
  'chevrolet-avalanche',
  'honda-ridgeline',
  'isuzu-d-max',
  'suzuki-kizashi',
  'lincoln-mkx',
  'lexus-hs',
  'fiat-albea',
  'ssangyong-rexton',
  'honda-pilot',
  'kia-cadenza',
  'chevrolet-lova',
  'honda-fr-v',
  'kia-opirus',
  'kia-optima',
  'gmc-terrain',
  'honda-freed',
  'toyota-sequoia',
  'lincoln-mks',
  'fiat-freemont',
  'lincoln-mkz',
  'volkswagen-golf-plus',
  'bmw-e70',
  'nissan-rogue',
  'mazda-tribute',
  'cadillac-srx',
  'chevrolet-colorado',
  'chevrolet-uplander',
  'toyota-allion',
  'nissan-nv200',
  'toyota-innova',
  'nissan-bluebird-sylphy',
  'fiat-sedici',
  'ford-five-hundred',
  'acura-mdx',
  'mercedes-benz-type-221',
  'ssangyong-rodius',
  'jeep-patriot',
  'toyota-matrix',
  'toyota-ractis',
  'toyota-urban-cruiser',
  'pontiac-vibe',
  'subaru-r2',
  'buick-lucerne',
  'toyota-vios',
  'lincoln-mkt',
  'suzuki-celerio',
  'volkswagen-golf-vi',
  'acura-rdx',
  'ssangyong-actyon',
  'mitsubishi-i',
  'byd-f0',
  'honda-element',
  'volkswagen-lavida',
  'proton-savvy',
  'toyota-wish',
  'toyota-probox',
  'gmc-acadia',
  'citroen-elysee',
  'toyota-isis',
  'buick-rainier',
  'buick-terraza',
  'ssangyong-kyron',
  'saturn-aura',
  'dodge-charger-lx',
  'kia-magentis',
  'samsung-sm3',
  'samsung-sm7',
  'volkswagen-routan',
  'lotus-2-eleven',
  'jeep-commander',
  'scion-tc',
  'daihatsu-tanto',
  'lincoln-blackwood',
  'mazda-verisa',
  'mercury-milan',
  'saturn-ion',
  'uaz-patriot',
  'daihatsu-yrv',
  'proton-waja',
  'chrysler-pacifica',
  'acura-zdx-2009',
  'zastava-z10',
  'ford-taurus-x',
  'geely-ck',
  'mitsubishi-endeavor',
  'bmw-hydrogen-7',
  'pontiac-g6',
  'subaru-stella',
  'byd-flyer',
  'mitsubishi-ek',
  'reva',
  'buick-excelle',
  'buick-rendezvous',
  'mahindra-scorpio',
  'daihatsu-materia',
  'ford-endeavour',
  'volkswagen-transporter-t5',
  'nissan-fuga',
  'chevrolet-agile',
  'pontiac-g8',
  'subaru-baja',
  'mitsubishi-zinger',
  'toyota-porte',
  'byd-e6',
  'honda-zest',
  'isuzu-ascender',
  'toyota-bb',
  'proton-gen-2',
  'bmw-x3-f25',
  'mercedes-benz-type-219',
  'mercury-mariner',
  'toyota-noah',
  'saturn-vue',
  'bmw-e83',
  'chevrolet-camaro',
  'chery-cowin',
  'tata-indigo',
  'kia-k5',
  'infiniti-qx80',
  'lifan-320',
  'subaru-exiga',
  'chevrolet-sail',
  'suzuki-mr-wagon',
  'great-wall-hover',
  'isuzu-axiom',
  'iveco-massif',
  'daihatsu-sonica',
  'mg-7',
  'mazda-biante',
  'lincoln-mark-lt',
  'nissan-livina',
  'volkswagen-passat-b6',
  'toyota-mark-x-zio',
  'chery-a5',
  'chery-fulwin-2',
  'toyota-sienta',
  'proton-exora',
  'suzuki-twin',
  'mitsubishi-savrin',
  'volkswagen-polo-iv',
  'jaguar-xj-x351',
  'rinspeed-squba',
  'pontiac-g5',
  'toyota-ist',
  'byd-f3',
  'geely-jiangang',
  'scion-xb',
  'daihatsu-esse',
  'honda-fcx',
  'mg-6',
  'mercedes-benz-type-164'
);

update public.cards set traits = array_append(traits, 'decennie-2010')
where not ('decennie-2010' = any (traits)) and slug in (
  'lamborghini-veneno',
  'lamborghini-sesto-elemento',
  'lykan-hypersport',
  'koenigsegg-regera',
  'lamborghini-egoista',
  'aston-martin-vulcan',
  'ferrari-fxx-k',
  'bugatti-la-voiture-noire',
  'lagonda-taraf',
  'gta-spano',
  'fenyr-supersport',
  'lamborghini-aventador',
  'lamborghini-huracan',
  'ferrari-laferrari',
  'bugatti-chiron',
  'ferrari-ff',
  'mclaren-mp4-12c',
  'lexus-lfa',
  'ferrari-sf90-stradale',
  'aston-martin-valkyrie',
  'mclaren-senna',
  'fisker-karma',
  'ferrari-gtc4lusso',
  'saab-9-4x',
  'ferrari-monza-sp1',
  'aston-martin-valhalla',
  'ford-transit-custom',
  'polestar-1',
  'nissan-leaf',
  'lamborghini-urus',
  'dacia-duster',
  'peugeot-208-i',
  'opel-adam',
  'peugeot-508',
  'lada-vesta',
  'volkswagen-amarok',
  'bmw-x7',
  'nissan-juke',
  'ferrari-f12-berlinetta',
  'porsche-taycan',
  'mazda-cx-5',
  'alfa-romeo-giulia-q2575932',
  'porsche-macan',
  'bmw-x4',
  'toyota-c-hr',
  'lada-2190',
  'jaguar-f-type',
  'aston-martin-rapide',
  'peugeot-2008',
  'toyota-gt86',
  'bmw-x2',
  'ferrari-488-gtb',
  'bentley-bentayga',
  'skoda-rapid-q180270',
  'lexus-ct',
  'volkswagen-t-roc',
  'renault-talisman',
  'jaguar-i-pace',
  'hyundai-i40',
  'opel-mokka',
  'citroen-c4-cactus',
  'mercedes-benz-gla',
  'bmw-m4',
  'range-rover-velar',
  'hyundai-kona',
  'mercedes-benz-citan',
  'alfa-romeo-4c',
  'peugeot-108',
  'skoda-kodiaq',
  'mazda-cx-3',
  'renault-kadjar',
  'jaguar-f-pace',
  'audi-q2',
  'aston-martin-db11',
  'volkswagen-arteon',
  'hyundai-veloster',
  'mazda-cx-30',
  'alfa-romeo-stelvio',
  'jaguar-xe',
  'opel-karl',
  'alfa-romeo-giulietta-q1417241',
  'chevrolet-trax',
  'chevrolet-orlando',
  'bmw-f30',
  'porsche-991',
  'opel-cascada',
  'mclaren-650-s',
  'seat-ateca',
  'ferrari-f8-tributo',
  'ds-5',
  'mclaren-720s',
  'renault-wind',
  'fiat-124-spider',
  'honda-cr-z',
  'ferrari-812-superfast',
  'ferrari-portofino',
  'rolls-royce-wraith-coupe',
  'citroen-c3-aircross',
  'rolls-royce-dawn',
  'dacia-dokker',
  'subaru-brz',
  'alpine-a110-q24936559',
  'lexus-lc',
  'porsche-911',
  'mclaren-570s',
  'mclaren-gt',
  'mercedes-benz-type-231',
  'bmw-m2',
  'bmw-z4-q39076484',
  'aston-martin-dbs-superleggera',
  'noble-m600',
  'citroen-c-zero',
  'citroen-ds6',
  'mercedes-benz-type-213',
  'aston-martin-vantage-q43452497',
  'mercedes-benz-type-172',
  'byd-qin',
  'ds-5ls',
  'mercedes-benz-type-217',
  'peugeot-408-berline',
  'mitsubishi-asx',
  'rolls-royce-cullinan',
  'skoda-scala',
  'cadillac-xts',
  'hyundai-ix20',
  'maserati-levante',
  'fiat-500l',
  'peugeot-301',
  'chrysler-200',
  'dacia-lodgy',
  'fiat-500x',
  'audi-q8',
  'kia-niro',
  'kia-stinger',
  'kia-stonic',
  'rolls-royce-phantom-2017',
  'volkswagen-t-cross',
  'lexus-ux',
  'skoda-kamiq',
  'volkswagen-coccinelle-iii',
  'volkswagen-golf-vii',
  'renault-latitude',
  'volvo-v40',
  'lexus-rc',
  'land-rover-discovery-sport',
  'volvo-s90',
  'seat-arona',
  'jaguar-e-pace',
  'renault-arkana',
  'ford-b-max',
  'lada-xray',
  'bmw-f20',
  'bentley-mulsanne',
  'lexus-nx',
  'renault-kwid',
  'cadillac-ct6',
  'cadillac-xt5',
  'fiat-tipo-q21207436',
  'mercedes-benz-classe-x',
  'opel-crossland',
  'citroen-c5-aircross',
  'hyundai-nexo',
  'hyundai-palisade',
  'hyundai-eon',
  'kia-k9',
  'peugeot-4008',
  'volvo-v60',
  'cadillac-xt6',
  'infiniti-q50',
  'hyundai-creta',
  'volkswagen-atlas',
  'cadillac-xt4',
  'bmw-g20',
  'lada-largus',
  'mini-countryman',
  'cadillac-ct5',
  'hyundai-venue',
  'citroen-c4-aircross',
  'infiniti-jx',
  'mercedes-benz-type-222',
  'bmw-f15',
  'bmw-f32',
  'mercedes-benz-type-205',
  'bmw-serie-2-active-tourer',
  'infiniti-q30',
  'bmw-g11',
  'ds-4',
  'ds-7-crossback',
  'mitsubishi-eclipse-cross',
  'subaru-levorg',
  'bmw-f22',
  'kia-telluride',
  'fiat-mobi',
  'seat-tarraco',
  'bmw-serie-8-ii',
  'nissan-kicks',
  'kia-seltos',
  'subaru-xv',
  'honda-brio',
  'ford-transit-courier',
  'ford-escort-chine',
  'kgm-tivoli',
  'genesis-g90',
  'fiat-toro',
  'volkswagen-phideon',
  'opel-grandland',
  'chevrolet-spin',
  'ford-puma-q65124485',
  'buick-verano',
  'mercedes-benz-type-218',
  'dodge-dart-2012',
  'ford-figo',
  'chevrolet-onix',
  'hyundai-hb20',
  'bmw-serie-3-gran-turismo',
  'honda-s660',
  'buick-envision',
  'byd-tang',
  'volvo-v90-q23306999',
  'mazda-cx-4',
  'kia-pegas',
  'fiat-cronos',
  'mercedes-amg-gt-4-portes',
  'bmw-g05',
  'chevrolet-blazer-2019',
  'lincoln-corsair',
  'hyundai-ix35',
  'acura-ilx',
  'suzuki-ertiga',
  'maserati-ghibli-iii',
  'mercedes-benz-type-166',
  'lincoln-mkc',
  'infiniti-qx30',
  'fiat-fullback',
  'genesis-g70',
  'baojun-510',
  'volkswagen-golf-viii',
  'byd-m6-2010',
  'changan-cs35-plus',
  'bmw-f40',
  'renault-triber',
  'infiniti-q70',
  'toyota-aqua',
  'nissan-nv',
  'acura-rlx',
  'runna',
  'qoros-3',
  'volkswagen-golf-sportsvan',
  'acura-tlx',
  'datsun-on-do',
  'hyundai-h350',
  'hyundai-mistra',
  'kia-k4-q20444159',
  'kia-kx3',
  'honda-br-v',
  'buick-encore',
  'honda-wr-v',
  'bmw-f52',
  'mg-zs',
  'byd-song',
  'maxus-d90',
  'chery-tiggo-8',
  'mg-hs',
  'chevrolet-monza-q63481262',
  'nio-es6',
  'chevrolet-tracker',
  'mg-5',
  'tatra-phoenix',
  'haval-h6',
  'proton-suprima-s',
  'hyundai-aslan',
  'bmw-f48',
  'chrysler-pacifica-monospace',
  'byd-e5',
  'suzuki-baleno-q23924645',
  'suzuki-brezza',
  'lynk-co-01',
  'bmw-serie-6-gran-turismo',
  'chery-tiggo-7',
  'subaru-ascent',
  'nio-es8',
  'kia-kx7',
  'lynk-co-03',
  'hyundai-reina'
);

update public.cards set traits = array_append(traits, 'decennie-2020')
where not ('decennie-2020' = any (traits)) and slug in (
  'lamborghini-sian-fkp-37',
  'bugatti-centodieci',
  'lotus-evija',
  'lamborghini-countach-ii',
  'hennessey-venom-f5',
  'mclaren-speedtail',
  'lamborghini-essenza-scv12',
  'mclaren-elva',
  'bugatti-w16-mistral',
  'koenigsegg-cc850',
  'pagani-utopia',
  'ferrari-f80',
  'mercedes-amg-project-one',
  'bugatti-tourbillon',
  'ferrari-daytona-sp3',
  'koenigsegg-gemera',
  'mclaren-w1',
  'tesla-cybertruck',
  'audi-e-tron-gt',
  'kia-ev6',
  'aston-martin-dbx',
  'ford-mustang-mach-e',
  'bmw-inext',
  'mazda-mx-30',
  'ferrari-roma',
  'toyota-corolla-cross',
  'hyundai-ioniq-5',
  'renault-5-e-tech',
  'lamborghini-revuelto',
  'maserati-mc20',
  'citroen-ami',
  'dacia-jogger',
  'rolls-royce-spectre',
  'ferrari-12cilindri',
  'lotus-emira',
  'ferrari-296-gtb',
  'lamborghini-temerario',
  'mclaren-artura',
  'ds-9',
  'renault-megane-e-tech-electric',
  'dacia-spring',
  'aston-martin-db12',
  'ferrari-849-testarossa',
  'ferrari-amalfi',
  'chevrolet-corvette-c8',
  'toyota-gr-yaris',
  'nissan-z',
  'ineos-grenadier',
  'mercedes-amg-r232',
  'volkswagen-taigo',
  'ferrari-purosangue',
  'hyundai-ioniq-6',
  'ferrari-luce',
  'polestar-2',
  'honda-e',
  'zeekr-001',
  'byd-dolphin',
  'bmw-ix3',
  'hyundai-bayon',
  'bmw-concept-xm',
  'renault-austral',
  'bmw-i4',
  'hyundai-ioniq-9',
  'tesla-cybercab',
  'cupra-tavascan',
  'maserati-grecale',
  'lotus-type-132',
  'polestar-4',
  'alfa-romeo-junior',
  'renault-4-e-tech-electric',
  'hyundai-staria',
  'cupra-formentor',
  'fiat-500e-2020',
  'kia-sonet',
  'kia-ev9',
  'mazda-cx-60',
  'jeep-compact-suv',
  'volvo-ex30',
  'ford-explorer-europe',
  'fiat-600',
  'fiat-grande-panda',
  'mazda-6e',
  'togg-t10x',
  'ford-capri-ev',
  'volvo-ex60',
  'genesis-gv80',
  'gmc-hummer-ev',
  'hyundai-santa-cruz',
  'skoda-kushaq',
  'mg4-ev',
  'renault-rafale',
  'byd-atto-2',
  'chevrolet-trailblazer-2019',
  'byd-han',
  'cadillac-celestiq',
  'kia-k8',
  'hyundai-casper',
  'byd-atto-3',
  'lotus-emeya',
  'volvo-ex90',
  'mercedes-benz-eqe-suv',
  'renault-scenic-e-tech',
  'kia-ev4',
  'kia-ev3',
  'bmw-serie-2-gran-coupe',
  'ford-bronco-sport',
  'nissan-magnite',
  'renault-kiger',
  'genesis-gv60',
  'skoda-slavia',
  'xpeng-g9',
  'nio-et5',
  'peugeot-408',
  'smart-hashtag-3',
  'yangwang-u8',
  'lexus-lm',
  'ford-maverick-q99643351',
  'genesis-gv70',
  'wuling-hongguang-mini-ev',
  'dacia-bigster',
  'mercedes-benz-type-206',
  'toyota-aygo-x',
  'honda-zr-v',
  'mazda-cx-50',
  'ssangyong-torres',
  'renault-kardian',
  'lexus-lbx',
  'renault-symbioz',
  'volvo-es90',
  'kia-k4',
  'opel-frontera-q125417137',
  'volkswagen-id-polo',
  'smart-hashtag-5',
  'rivian-r1t',
  'hyundai-aura',
  'hyundai-custo',
  'nio-et7',
  'volkswagen-talagon',
  'subaru-solterra',
  'bmw-g70',
  'hyundai-stargazer',
  'li-auto-l9',
  'honda-prologue',
  'denza-d9',
  'xpeng-g6',
  'volvo-em90',
  'skoda-epiq',
  'mazda-cx-80',
  'volkswagen-taigun'
);

/* ---------- open_pack: a weekend pack only opens on its weekend ---------- */

create or replace function public.open_pack(p_pack text, p_pay boolean default false)
returns table (copy_id uuid, card_slug text, serial int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  pk public.packs;
  w public.pack_wallets;
  gained int;
  avail int;
  grp jsonb;
  odds jsonb;
  roll double precision;
  slot_tier text;
  pick text;
  themed boolean;
  minted_now int;
  new_copy uuid;
  pulled uuid[] := '{}';
  tiers text[] := array['common', 'rare', 'epic', 'legendary'];
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into pk from public.packs where id = p_pack;
  if not found then
    raise exception 'unknown pack';
  end if;
  if pk.rotation is not null and pk.id is distinct from public.weekend_pack() then
    raise exception 'pack not available';
  end if;

  insert into public.pack_wallets (user_id) values (uid) on conflict do nothing;
  select * into w from public.pack_wallets where user_id = uid for update;

  if pk.free and not p_pay then
    gained := floor(extract(epoch from (now() - w.anchor_at)) / 600)::int;
    avail := least(10, w.stored + gained);

    if avail >= 1 then
      if w.stored + gained >= 10 then
        update public.pack_wallets set stored = 9, anchor_at = now() where user_id = uid;
      else
        update public.pack_wallets
          set stored = avail - 1,
              anchor_at = w.anchor_at + make_interval(secs => gained * 600)
          where user_id = uid;
      end if;
    elsif w.bonus >= 1 then
      update public.pack_wallets set bonus = bonus - 1 where user_id = uid;
    else
      raise exception 'no packs available' using errcode = 'P0001';
    end if;
  else
    perform public.move_coins(uid, -pk.price, 'pack', pk.id);
  end if;

  for grp in select value from jsonb_array_elements(pk.slots) loop
    odds := grp -> 'odds';
    for i in 1..(grp ->> 'n')::int loop
      roll := random() * 100;
      slot_tier := case
        when roll < (odds ->> 0)::numeric then 'common'
        when roll < (odds ->> 0)::numeric + (odds ->> 1)::numeric then 'rare'
        when roll < (odds ->> 0)::numeric + (odds ->> 1)::numeric + (odds ->> 2)::numeric then 'epic'
        else 'legendary'
      end;

      pick := null;
      -- The slot is themed on a fixed share; a tier with no themed card left
      -- gives any card of that tier. A sold-out tier falls back to the next tier down.
      themed := cardinality(pk.themes) > 0 and random() < pk.theme_share;
      for t in reverse array_position(tiers, slot_tier)..1 loop
        if themed then
          select c.slug into pick
          from public.cards c
          where c.tier = tiers[t] and (c.supply is null or c.minted < c.supply) and c.traits && pk.themes
          order by random()
          limit 1;
        end if;
        if pick is null then
          select c.slug into pick
          from public.cards c
          where c.tier = tiers[t] and (c.supply is null or c.minted < c.supply)
          order by random()
          limit 1;
        end if;
        exit when pick is not null;
      end loop;

      if pick is null then
        raise exception 'catalogue sold out';
      end if;

      update public.cards set minted = minted + 1 where slug = pick returning minted into minted_now;
      insert into public.card_copies (card_slug, serial, owner_id, obtained_via)
        values (pick, minted_now, uid, 'pack')
        returning id into new_copy;
      pulled := pulled || new_copy;

      copy_id := new_copy;
      card_slug := pick;
      serial := minted_now;
      return next;
    end loop;
  end loop;

  insert into public.pack_openings (user_id, pack_id, copies) values (uid, p_pack, pulled);
end;
$$;

/* ---------- Missions: three a day, three a week, same for everyone ---------- */

alter table public.coin_ledger drop constraint coin_ledger_reason_check;
alter table public.coin_ledger add constraint coin_ledger_reason_check
  check (reason in ('daily', 'achievement', 'sell', 'pack', 'shop', 'mission'));

-- grp: a board draws one mission per group, so it always mixes packs, pulls
-- and the rest. Every mission here must have a label in lib/missions.ts.
create table public.missions (
  id text primary key,
  cadence text not null check (cadence in ('day', 'week')),
  grp smallint not null,
  kind text not null check (kind in ('open', 'open_pack', 'pull_tier', 'pull_trait', 'offer', 'trade', 'sell', 'buy', 'daily')),
  param text,
  goal int not null check (goal > 0),
  reward int not null check (reward > 0)
);

create table public.mission_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null,
  mission_id text not null references public.missions (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (user_id, period, mission_id)
);

alter table public.missions enable row level security;
alter table public.mission_claims enable row level security;
create policy "Missions are public" on public.missions for select to anon, authenticated using (true);
create policy "Players read their mission claims" on public.mission_claims
  for select to authenticated using ((select auth.uid()) = user_id);

insert into public.missions (id, cadence, grp, kind, param, goal, reward) values
  ('d-open-3', 'day', 0, 'open', null, 3, 25),
  ('d-open-5', 'day', 0, 'open', null, 5, 35),
  ('d-pack-edition-01', 'day', 0, 'open_pack', 'edition-01', 2, 30),
  ('d-pack-nuit-jdm', 'day', 0, 'open_pack', 'nuit-jdm', 2, 30),
  ('d-pack-grand-tourisme', 'day', 0, 'open_pack', 'grand-tourisme', 2, 30),
  ('d-pack-garage-classique', 'day', 0, 'open_pack', 'garage-classique', 2, 30),
  ('d-pack-reve-americain', 'day', 0, 'open_pack', 'reve-americain', 2, 30),
  ('d-pack-hors-piste', 'day', 0, 'open_pack', 'hors-piste', 2, 30),
  ('d-tier-rare', 'day', 1, 'pull_tier', 'rare', 4, 25),
  ('d-tier-epic', 'day', 1, 'pull_tier', 'epic', 1, 40),
  ('d-trait-jdm', 'day', 1, 'pull_trait', 'JDM', 3, 30),
  ('d-trait-us', 'day', 1, 'pull_trait', 'US', 3, 30),
  ('d-trait-classique', 'day', 1, 'pull_trait', 'classique', 3, 30),
  ('d-trait-youngtimer', 'day', 1, 'pull_trait', 'youngtimer', 3, 30),
  ('d-trait-tout-terrain', 'day', 1, 'pull_trait', 'tout-terrain', 3, 30),
  ('d-daily', 'day', 2, 'daily', null, 1, 20),
  ('d-sell-5', 'day', 2, 'sell', null, 5, 20),
  ('d-offer', 'day', 2, 'offer', null, 1, 30),
  ('d-buy', 'day', 2, 'buy', null, 1, 30),
  ('w-open-20', 'week', 0, 'open', null, 20, 120),
  ('w-open-35', 'week', 0, 'open', null, 35, 180),
  ('w-pack-nuit-jdm', 'week', 0, 'open_pack', 'nuit-jdm', 8, 150),
  ('w-pack-garage-classique', 'week', 0, 'open_pack', 'garage-classique', 8, 150),
  ('w-pack-reve-americain', 'week', 0, 'open_pack', 'reve-americain', 8, 150),
  ('w-pack-hors-piste', 'week', 0, 'open_pack', 'hors-piste', 8, 150),
  ('w-tier-epic', 'week', 1, 'pull_tier', 'epic', 4, 150),
  ('w-tier-legendary', 'week', 1, 'pull_tier', 'legendary', 1, 250),
  ('w-trait-jdm', 'week', 1, 'pull_trait', 'JDM', 15, 120),
  ('w-trait-euro', 'week', 1, 'pull_trait', 'Euro', 25, 120),
  ('w-trait-sportive', 'week', 1, 'pull_trait', 'sportive', 6, 150),
  ('w-trait-luxe', 'week', 1, 'pull_trait', 'luxe', 8, 120),
  ('w-trade-2', 'week', 2, 'trade', null, 2, 150),
  ('w-offer-3', 'week', 2, 'offer', null, 3, 100),
  ('w-daily-5', 'week', 2, 'daily', null, 5, 120),
  ('w-sell-30', 'week', 2, 'sell', null, 30, 100),
  ('w-buy-3', 'week', 2, 'buy', null, 3, 120);

-- How far a player got since a moment, for one kind of mission.
create function public.mission_progress(p_user uuid, p_kind text, p_param text, p_since timestamptz)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'open' then (
      select count(*) from public.pack_openings where user_id = p_user and opened_at >= p_since)
    when 'open_pack' then (
      select count(*) from public.pack_openings where user_id = p_user and opened_at >= p_since and pack_id = p_param)
    when 'pull_tier' then (
      select count(*)
      from public.pack_openings o
      join public.card_copies c on c.id = any (o.copies)
      join public.cards k on k.slug = c.card_slug
      where o.user_id = p_user and o.opened_at >= p_since
        and array_position(array['common', 'rare', 'epic', 'legendary'], k.tier)
            >= array_position(array['common', 'rare', 'epic', 'legendary'], p_param))
    when 'pull_trait' then (
      select count(*)
      from public.pack_openings o
      join public.card_copies c on c.id = any (o.copies)
      join public.cards k on k.slug = c.card_slug
      where o.user_id = p_user and o.opened_at >= p_since and p_param = any (k.traits))
    when 'offer' then (
      select count(*) from public.trades where from_id = p_user and created_at >= p_since)
    when 'trade' then (
      select count(*) from public.trades
      where status = 'accepted' and p_user in (from_id, to_id) and resolved_at >= p_since)
    when 'sell' then (
      select count(*) from public.coin_ledger where user_id = p_user and reason = 'sell' and created_at >= p_since)
    when 'buy' then (
      select count(*) from public.shop_purchases where user_id = p_user and created_at >= p_since)
    when 'daily' then (
      select count(*) from public.coin_ledger where user_id = p_user and reason = 'daily' and created_at >= p_since)
    else 0
  end::int;
$$;

-- Today's and this week's missions: one per group, drawn from the period.
create function public.mission_board(p_user uuid)
returns table (
  period text,
  cadence text,
  mission_id text,
  kind text,
  param text,
  goal int,
  reward int,
  progress int,
  claimed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select s.day, s.week,
           (date_trunc('day', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris' as day_start,
           (date_trunc('week', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris' as week_start
    from public.shop_periods() s
  ),
  picked as (
    select distinct on (m.cadence, m.grp)
           case m.cadence when 'day' then p.day else p.week end as period,
           case m.cadence when 'day' then p.day_start else p.week_start end as since,
           m.*
    from public.missions m, p
    order by m.cadence, m.grp, md5(m.id || case m.cadence when 'day' then p.day else p.week end)
  )
  select x.period, x.cadence, x.id, x.kind, x.param, x.goal, x.reward,
         least(public.mission_progress(p_user, x.kind, x.param, x.since), x.goal),
         exists (
           select 1 from public.mission_claims mc
           where mc.user_id = p_user and mc.period = x.period and mc.mission_id = x.id
         )
  from picked x
  order by x.cadence, x.grp;
$$;

create function public.my_missions()
returns table (
  period text,
  cadence text,
  mission_id text,
  kind text,
  param text,
  goal int,
  reward int,
  progress int,
  claimed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.mission_board((select auth.uid()));
$$;

-- Claims every finished mission on the board; returns the jetons won.
create function public.claim_missions()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  m record;
  total int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  for m in select * from public.mission_board(uid) b where b.progress >= b.goal and not b.claimed loop
    insert into public.mission_claims (user_id, period, mission_id) values (uid, m.period, m.mission_id)
      on conflict do nothing;
    if found then
      total := total + m.reward;
    end if;
  end loop;

  if total > 0 then
    perform public.move_coins(uid, total, 'mission', null);
  end if;
  return total;
end;
$$;

/* ---------- Wallet: finished missions, and the daily shop drawn early ---------- */

drop function public.my_pack_wallet();

create function public.my_pack_wallet()
returns table (
  available int,
  next_at timestamptz,
  bonus int,
  coins int,
  daily_ready boolean,
  streak int,
  claimable int,
  missions int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := public.paris_today();
  w public.pack_wallets;
  gained int;
  avail int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Draws the day's shop window as soon as anyone plays, so wishlist alerts
  -- don't wait for a visit to the shop.
  perform public.ensure_shop_offers();

  insert into public.pack_wallets (user_id) values (uid) on conflict do nothing;
  select * into w from public.pack_wallets where user_id = uid;

  gained := floor(extract(epoch from (now() - w.anchor_at)) / 600)::int;
  avail := least(10, w.stored + gained);

  return query select
    avail,
    case
      when avail >= 10 then null
      else w.anchor_at + make_interval(secs => (gained + 1) * 600)
    end,
    w.bonus,
    w.coins,
    w.daily_on is distinct from today,
    case when w.daily_on >= today - 1 then w.streak else 0 end,
    (select count(*)::int from public.claimable_achievements(uid)),
    (select count(*)::int from public.mission_board(uid) b where b.progress >= b.goal and not b.claimed);
end;
$$;

/* ---------- Grants ---------- */

revoke execute on function public.notify_wishers(text, text, uuid) from public, anon, authenticated;
revoke execute on function public.on_copy_owner() from public, anon, authenticated;
revoke execute on function public.on_shop_stock() from public, anon, authenticated;
revoke execute on function public.on_shop_offer() from public, anon, authenticated;
revoke execute on function public.mission_progress(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.mission_board(uuid) from public, anon, authenticated;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
revoke execute on function public.set_wish(text, boolean) from public, anon;
revoke execute on function public.my_missions() from public, anon;
revoke execute on function public.claim_missions() from public, anon;
revoke execute on function public.my_pack_wallet() from public, anon;

grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.set_wish(text, boolean) to authenticated;
grant execute on function public.my_missions() to authenticated;
grant execute on function public.claim_missions() to authenticated;
grant execute on function public.my_pack_wallet() to authenticated;
grant execute on function public.weekend_pack() to anon, authenticated;
