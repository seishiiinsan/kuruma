-- No car is tagged supercar/hypercar in the open data; sports cars carry the pack.
update public.packs set themes = '{gt,sportive}' where id = 'grand-tourisme';
