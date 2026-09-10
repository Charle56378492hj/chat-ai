/*
# RLS Policies — Extended Tables

Owner-scoped access control for AI, automation, billing, security, and admin tables.
Most tables allow owner + members; audit_logs, api_keys, and invoices are owner-only.
*/

-- ============ AI CONFIGS ============
DROP POLICY IF EXISTS "select_own_ai_configs" ON ai_configs;
CREATE POLICY "select_own_ai_configs" ON ai_configs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_configs.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_configs.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_ai_configs" ON ai_configs;
CREATE POLICY "insert_own_ai_configs" ON ai_configs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_configs.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_ai_configs" ON ai_configs;
CREATE POLICY "update_own_ai_configs" ON ai_configs FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_configs.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_configs.merchant_id AND merchant_members.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_configs.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_configs.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_ai_configs" ON ai_configs;
CREATE POLICY "delete_own_ai_configs" ON ai_configs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_configs.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ AI KNOWLEDGE SOURCES ============
DROP POLICY IF EXISTS "select_own_ai_knowledge" ON ai_knowledge_sources;
CREATE POLICY "select_own_ai_knowledge" ON ai_knowledge_sources FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_knowledge_sources.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_knowledge_sources.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_ai_knowledge" ON ai_knowledge_sources;
CREATE POLICY "insert_own_ai_knowledge" ON ai_knowledge_sources FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_knowledge_sources.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_knowledge_sources.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_ai_knowledge" ON ai_knowledge_sources;
CREATE POLICY "update_own_ai_knowledge" ON ai_knowledge_sources FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_knowledge_sources.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_knowledge_sources.merchant_id AND merchant_members.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_knowledge_sources.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_knowledge_sources.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_ai_knowledge" ON ai_knowledge_sources;
CREATE POLICY "delete_own_ai_knowledge" ON ai_knowledge_sources FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_knowledge_sources.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ AI TRAINING SCENARIOS ============
DROP POLICY IF EXISTS "select_own_ai_scenarios" ON ai_training_scenarios;
CREATE POLICY "select_own_ai_scenarios" ON ai_training_scenarios FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_training_scenarios.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_training_scenarios.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_ai_scenarios" ON ai_training_scenarios;
CREATE POLICY "insert_own_ai_scenarios" ON ai_training_scenarios FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_training_scenarios.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_training_scenarios.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_ai_scenarios" ON ai_training_scenarios;
CREATE POLICY "update_own_ai_scenarios" ON ai_training_scenarios FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_training_scenarios.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_training_scenarios.merchant_id AND merchant_members.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_training_scenarios.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_training_scenarios.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_ai_scenarios" ON ai_training_scenarios;
CREATE POLICY "delete_own_ai_scenarios" ON ai_training_scenarios FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_training_scenarios.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ AI VERSIONS ============
DROP POLICY IF EXISTS "select_own_ai_versions" ON ai_versions;
CREATE POLICY "select_own_ai_versions" ON ai_versions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_versions.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = ai_versions.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_ai_versions" ON ai_versions;
CREATE POLICY "insert_own_ai_versions" ON ai_versions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_versions.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_ai_versions" ON ai_versions;
CREATE POLICY "delete_own_ai_versions" ON ai_versions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = ai_versions.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ AUTOMATION RULES ============
DROP POLICY IF EXISTS "select_own_automation_rules" ON automation_rules;
CREATE POLICY "select_own_automation_rules" ON automation_rules FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = automation_rules.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = automation_rules.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_automation_rules" ON automation_rules;
CREATE POLICY "insert_own_automation_rules" ON automation_rules FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = automation_rules.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = automation_rules.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_automation_rules" ON automation_rules;
CREATE POLICY "update_own_automation_rules" ON automation_rules FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = automation_rules.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = automation_rules.merchant_id AND merchant_members.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = automation_rules.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = automation_rules.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_automation_rules" ON automation_rules;
CREATE POLICY "delete_own_automation_rules" ON automation_rules FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = automation_rules.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ WORKFLOWS ============
DROP POLICY IF EXISTS "select_own_workflows" ON workflows;
CREATE POLICY "select_own_workflows" ON workflows FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = workflows.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = workflows.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_workflows" ON workflows;
CREATE POLICY "insert_own_workflows" ON workflows FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = workflows.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = workflows.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_workflows" ON workflows;
CREATE POLICY "update_own_workflows" ON workflows FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = workflows.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = workflows.merchant_id AND merchant_members.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = workflows.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = workflows.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_workflows" ON workflows;
CREATE POLICY "delete_own_workflows" ON workflows FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = workflows.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ TEMPLATES ============
DROP POLICY IF EXISTS "select_own_templates" ON templates;
CREATE POLICY "select_own_templates" ON templates FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = templates.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = templates.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_templates" ON templates;
CREATE POLICY "insert_own_templates" ON templates FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = templates.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = templates.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_templates" ON templates;
CREATE POLICY "update_own_templates" ON templates FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = templates.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = templates.merchant_id AND merchant_members.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = templates.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = templates.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_templates" ON templates;
CREATE POLICY "delete_own_templates" ON templates FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = templates.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ AUDIT LOGS (owner only) ============
DROP POLICY IF EXISTS "select_own_audit_logs" ON audit_logs;
CREATE POLICY "select_own_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = audit_logs.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_audit_logs" ON audit_logs;
CREATE POLICY "insert_own_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = audit_logs.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = audit_logs.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_audit_logs" ON audit_logs;
CREATE POLICY "delete_own_audit_logs" ON audit_logs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = audit_logs.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ API KEYS (owner only) ============
DROP POLICY IF EXISTS "select_own_api_keys" ON api_keys;
CREATE POLICY "select_own_api_keys" ON api_keys FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = api_keys.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_api_keys" ON api_keys;
CREATE POLICY "insert_own_api_keys" ON api_keys FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = api_keys.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_api_keys" ON api_keys;
CREATE POLICY "update_own_api_keys" ON api_keys FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = api_keys.merchant_id AND merchants.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = api_keys.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_api_keys" ON api_keys;
CREATE POLICY "delete_own_api_keys" ON api_keys FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = api_keys.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ SUBSCRIPTIONS ============
DROP POLICY IF EXISTS "select_own_subscriptions" ON subscriptions;
CREATE POLICY "select_own_subscriptions" ON subscriptions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = subscriptions.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = subscriptions.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_subscriptions" ON subscriptions;
CREATE POLICY "insert_own_subscriptions" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = subscriptions.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_subscriptions" ON subscriptions;
CREATE POLICY "update_own_subscriptions" ON subscriptions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = subscriptions.merchant_id AND merchants.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = subscriptions.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_subscriptions" ON subscriptions;
CREATE POLICY "delete_own_subscriptions" ON subscriptions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = subscriptions.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ INVOICES (owner only) ============
DROP POLICY IF EXISTS "select_own_invoices" ON invoices;
CREATE POLICY "select_own_invoices" ON invoices FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = invoices.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_invoices" ON invoices;
CREATE POLICY "insert_own_invoices" ON invoices FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = invoices.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_invoices" ON invoices;
CREATE POLICY "delete_own_invoices" ON invoices FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = invoices.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ SUPPORT TICKETS ============
DROP POLICY IF EXISTS "select_own_support_tickets" ON support_tickets;
CREATE POLICY "select_own_support_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = support_tickets.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = support_tickets.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_support_tickets" ON support_tickets;
CREATE POLICY "insert_own_support_tickets" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = support_tickets.merchant_id AND merchants.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = support_tickets.merchant_id AND merchant_members.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_support_tickets" ON support_tickets;
CREATE POLICY "update_own_support_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = support_tickets.merchant_id AND merchants.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = support_tickets.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_support_tickets" ON support_tickets;
CREATE POLICY "delete_own_support_tickets" ON support_tickets FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = support_tickets.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ SUPER ADMIN FLAGS (owner only) ============
DROP POLICY IF EXISTS "select_own_super_admin_flags" ON super_admin_flags;
CREATE POLICY "select_own_super_admin_flags" ON super_admin_flags FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = super_admin_flags.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_super_admin_flags" ON super_admin_flags;
CREATE POLICY "insert_own_super_admin_flags" ON super_admin_flags FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = super_admin_flags.merchant_id AND merchants.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_super_admin_flags" ON super_admin_flags;
CREATE POLICY "delete_own_super_admin_flags" ON super_admin_flags FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM merchants WHERE merchants.id = super_admin_flags.merchant_id AND merchants.owner_id = auth.uid())
  );

-- ============ CUSTOMER PORTAL TOKENS ============
DROP POLICY IF EXISTS "select_own_portal_tokens" ON customer_portal_tokens;
CREATE POLICY "select_own_portal_tokens" ON customer_portal_tokens FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN merchants ON merchants.id = orders.merchant_id
      WHERE orders.id = customer_portal_tokens.order_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  );
DROP POLICY IF EXISTS "insert_own_portal_tokens" ON customer_portal_tokens;
CREATE POLICY "insert_own_portal_tokens" ON customer_portal_tokens FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      JOIN merchants ON merchants.id = orders.merchant_id
      WHERE orders.id = customer_portal_tokens.order_id
      AND (merchants.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM merchant_members WHERE merchant_members.merchant_id = merchants.id AND merchant_members.user_id = auth.uid()))
    )
  );
DROP POLICY IF EXISTS "delete_own_portal_tokens" ON customer_portal_tokens;
CREATE POLICY "delete_own_portal_tokens" ON customer_portal_tokens FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN merchants ON merchants.id = orders.merchant_id
      WHERE orders.id = customer_portal_tokens.order_id
      AND merchants.owner_id = auth.uid()
    )
  );