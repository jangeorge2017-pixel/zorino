update stores
set logo_url = case lower(regexp_replace(coalesce(slug, ''), '[^a-z0-9]', '', 'g'))
  when 'amazon' then '/stores/amazon.svg'
  when 'amazoneg' then '/stores/amazon.svg'
  when 'aliexpress' then '/stores/aliexpress.svg'
  when 'ebay' then '/stores/ebay.svg'
  when 'noon' then '/stores/noon.svg'
  when 'noonegypt' then '/stores/noon.svg'
  when 'jumia' then '/stores/jumia.svg'
  when 'jumiaegypt' then '/stores/jumia.svg'
  when 'carrefour' then '/stores/carrefour.svg'
  when 'carrefouregypt' then '/stores/carrefour.svg'
  when 'btech' then '/stores/btech.svg'
  when 'twob' then '/stores/twob.svg'
  when 'dubaiphone' then '/stores/dubaiphone.svg'
  when 'raneen' then '/stores/raneen.svg'
  when 'eldokan' then '/stores/eldokan.svg'
  when 'temu' then '/stores/temu.svg'
  when 'bestbuy' then '/stores/best-buy.svg'
  when 'walmart' then '/stores/walmart.svg'
  when 'cjdropshipping' then '/stores/cjdropshipping.svg'
  when 'alibaba' then '/stores/alibaba.svg'
  when 'admitad' then '/stores/admitad.svg'
  when 'apple' then '/stores/apple.svg'
  when 'samsung' then '/stores/samsung.svg'
  when 'nike' then '/stores/nike.svg'
  when 'adidas' then '/stores/adidas.svg'
  when 'shein' then '/stores/shein.svg'
  when 'footlocker' then '/stores/foot-locker.svg'
  else '/stores/default.svg'
end
where lower(regexp_replace(coalesce(slug, ''), '[^a-z0-9]', '', 'g')) in (
  'amazon', 'amazoneg', 'aliexpress', 'ebay', 'noon', 'noonegypt', 'jumia',
  'jumiaegypt', 'carrefour', 'carrefouregypt', 'btech', 'twob', 'dubaiphone',
  'raneen', 'eldokan', 'temu', 'bestbuy', 'walmart', 'cjdropshipping',
  'alibaba', 'admitad', 'apple', 'samsung', 'nike', 'adidas', 'shein', 'footlocker'
)
or logo_url is null
or trim(logo_url) = '';

update stores
set logo_initial = upper(left(trim(coalesce(name, slug, 'Z')), 2))
where logo_initial is null
  or trim(logo_initial) = '';
