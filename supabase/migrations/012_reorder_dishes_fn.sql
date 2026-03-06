CREATE OR REPLACE FUNCTION reorder_dishes(items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    UPDATE dishes
    SET sort_order = (item->>'order')::int
    WHERE id = (item->>'id')::uuid;
  END LOOP;
END;
$$;
