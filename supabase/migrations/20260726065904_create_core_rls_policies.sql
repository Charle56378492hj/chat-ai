/*
# RLS Policies — Core Tables

Enables owner-scoped access control on all core tables. Access is granted
when the user is either the merchant owner or a member of the merchant's team.
*/

-- Helper: a user is part of a merchant (owner or member)
-- We inline this check in each policy.

-- ============ MERCHANTS ============
DROP POLICY IF EXISTS "select_own_merchants" ON merchants;
CREATE POLICY "select_own_merchants" ON merchants FOR SELECT
  TO authenticated USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_merchants" ON merchants;
CREATE POLICY "insert_own_merchants" ON merchants FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "update_own_merchants" ON merchants;
CREATE POLICY "update_own_merchants" ON merchants FOR UPDATE
  TO authenticated USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "delete_own_merchants" ON merchants;
CREATE POLICY "delete_own_merchants" ON merchants FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- ============ MERCHANT MEMBERS ============
DROP POLICY IF EXISTS "select_own_members" ON merchant_members;
CREATE POLICY "select_own_members" ON merchant_members FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM merchants WHERE merchants.id = merchant_members.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_members" ON merchant_members;
CREATE POLICY "insert_own_members" ON merchant_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = merchant_members.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_members" ON merchant_members;
CREATE POLICY "update_own_members" ON merchant_members FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = merchant_members.merchant_id AND merchants.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = merchant_members.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_members" ON merchant_members;
CREATE POLICY "delete_own_members" ON merchant_members FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = merchant_members.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ CHANNELS ============
DROP POLICY IF EXISTS "select_own_channels" ON channels;
CREATE POLICY "select_own_channels" ON channels FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = channels.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = channels.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_channels" ON channels;
CREATE POLICY "insert_own_channels" ON channels FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = channels.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_channels" ON channels;
CREATE POLICY "update_own_channels" ON channels FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = channels.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = channels.merchant_id AND merchant_members.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = channels.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = channels.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_channels" ON channels;
CREATE POLICY "delete_own_channels" ON channels FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = channels.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ CUSTOMERS ============
DROP POLICY IF EXISTS "select_own_customers" ON customers;
CREATE POLICY "select_own_customers" ON customers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = customers.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = customers.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_customers" ON customers;
CREATE POLICY "insert_own_customers" ON customers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = customers.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = customers.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_customers" ON customers;
CREATE POLICY "update_own_customers" ON customers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = customers.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = customers.merchant_id AND merchant_members.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = customers.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = customers.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_customers" ON customers;
CREATE POLICY "delete_own_customers" ON customers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = customers.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ CONVERSATIONS ============
DROP POLICY IF EXISTS "select_own_conversations" ON conversations;
CREATE POLICY "select_own_conversations" ON conversations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = conversations.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = conversations.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_conversations" ON conversations;
CREATE POLICY "insert_own_conversations" ON conversations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = conversations.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = conversations.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_conversations" ON conversations;
CREATE POLICY "update_own_conversations" ON conversations FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = conversations.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = conversations.merchant_id AND merchant_members.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = conversations.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = conversations.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_conversations" ON conversations;
CREATE POLICY "delete_own_conversations" ON conversations FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = conversations.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ MESSAGES ============
DROP POLICY IF EXISTS "select_own_messages" ON messages;
CREATE POLICY "select_own_messages" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations
      JOIN merchants ON merchants.id = conversations.merchant_id
      WHERE conversations.id = messages.conversation_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  );
DROP POLICY IF EXISTS "insert_own_messages" ON messages;
CREATE POLICY "insert_own_messages" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      JOIN merchants ON merchants.id = conversations.merchant_id
      WHERE conversations.id = messages.conversation_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  );
DROP POLICY IF EXISTS "update_own_messages" ON messages;
CREATE POLICY "update_own_messages" ON messages FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations
      JOIN merchants ON merchants.id = conversations.merchant_id
      WHERE conversations.id = messages.conversation_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      JOIN merchants ON merchants.id = conversations.merchant_id
      WHERE conversations.id = messages.conversation_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  );
DROP POLICY IF EXISTS "delete_own_messages" ON messages;
CREATE POLICY "delete_own_messages" ON messages FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations
      JOIN merchants ON merchants.id = conversations.merchant_id
      WHERE conversations.id = messages.conversation_id
      AND merchants.owner_id = auth.uid()
    )
  );

-- ============ CATEGORIES ============
DROP POLICY IF EXISTS "select_own_categories" ON categories;
CREATE POLICY "select_own_categories" ON categories FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = categories.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = categories.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_categories" ON categories;
CREATE POLICY "insert_own_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = categories.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_categories" ON categories;
CREATE POLICY "update_own_categories" ON categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = categories.merchant_id AND merchants.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = categories.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_categories" ON categories;
CREATE POLICY "delete_own_categories" ON categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = categories.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ PRODUCTS ============
DROP POLICY IF EXISTS "select_own_products" ON products;
CREATE POLICY "select_own_products" ON products FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = products.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = products.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = products.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = products.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = products.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = products.merchant_id AND merchant_members.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = products.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = products.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = products.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ PRODUCT VARIANTS ============
DROP POLICY IF EXISTS "select_own_variants" ON product_variants;
CREATE POLICY "select_own_variants" ON product_variants FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM products
      JOIN merchants ON merchants.id = products.merchant_id
      WHERE products.id = product_variants.product_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  );
DROP POLICY IF EXISTS "insert_own_variants" ON product_variants;
CREATE POLICY "insert_own_variants" ON product_variants FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      JOIN merchants ON merchants.id = products.merchant_id
      WHERE products.id = product_variants.product_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  );
DROP POLICY IF EXISTS "update_own_variants" ON product_variants;
CREATE POLICY "update_own_variants" ON product_variants FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM products
      JOIN merchants ON merchants.id = products.merchant_id
      WHERE products.id = product_variants.product_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      JOIN merchants ON merchants.id = products.merchant_id
      WHERE products.id = product_variants.product_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  );
DROP POLICY IF EXISTS "delete_own_variants" ON product_variants;
CREATE POLICY "delete_own_variants" ON product_variants FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM products
      JOIN merchants ON merchants.id = products.merchant_id
      WHERE products.id = product_variants.product_id
      AND merchants.owner_id = auth.uid()
    )
  );

-- ============ ORDERS ============
DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = orders.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = orders.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = orders.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = orders.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = orders.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = orders.merchant_id AND merchant_members.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = orders.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = orders.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_orders" ON orders;
CREATE POLICY "delete_own_orders" ON orders FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = orders.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ ORDER ITEMS ============
DROP POLICY IF EXISTS "select_own_order_items" ON order_items;
CREATE POLICY "select_own_order_items" ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN merchants ON merchants.id = orders.merchant_id
      WHERE orders.id = order_items.order_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  );
DROP POLICY IF EXISTS "insert_own_order_items" ON order_items;
CREATE POLICY "insert_own_order_items" ON order_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      JOIN merchants ON merchants.id = orders.merchant_id
      WHERE orders.id = order_items.order_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  );
DROP POLICY IF EXISTS "update_own_order_items" ON order_items;
CREATE POLICY "update_own_order_items" ON order_items FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN merchants ON merchants.id = orders.merchant_id
      WHERE orders.id = order_items.order_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      JOIN merchants ON merchants.id = orders.merchant_id
      WHERE orders.id = order_items.order_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  );
DROP POLICY IF EXISTS "delete_own_order_items" ON order_items;
CREATE POLICY "delete_own_order_items" ON order_items FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN merchants ON merchants.id = orders.merchant_id
      WHERE orders.id = order_items.order_id
      AND merchants.owner_id = auth.uid()
    )
  );