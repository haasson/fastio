-- Normalize customer_phone: strip non-digits, replace leading 8 with 7
UPDATE orders
SET customer_phone = (
  CASE
    WHEN regexp_replace(customer_phone, '[^0-9]', '', 'g') LIKE '8%'
      THEN '7' || substr(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 2)
    ELSE regexp_replace(customer_phone, '[^0-9]', '', 'g')
  END
)
WHERE customer_phone ~ '[^0-9]' OR customer_phone LIKE '8%';
