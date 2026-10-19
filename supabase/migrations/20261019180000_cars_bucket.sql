-- Card photos, copied from Wikimedia Commons by scripts/cars/photos.mjs:
-- Commons throttles hotlinked thumbnails, so the app serves its own copies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cars', 'cars', true, 1048576, array['image/webp'])
on conflict (id) do nothing;
