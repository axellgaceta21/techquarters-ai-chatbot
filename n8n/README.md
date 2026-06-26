# TechQuarters chatbot workflow

Import `techquarters-chatbot-events.workflow.json` into n8n, assign the existing Telegram credential to the three Telegram nodes, set `TELEGRAM_CHAT_ID` in n8n, and activate the workflow.

The Switch node intentionally has exactly three outputs:

1. `conversation_summary_ready`
2. `booking_offered`
3. `booking_clicked`

`lead_scored` is not routed to Telegram. Lead scoring is persisted by the application directly to Supabase.

The Webhook node uses `When Last Node Finishes` (`responseMode: lastNode`).
This is required so the chatbot does not dispatch `booking_offered` until the
preceding `conversation_summary_ready` Telegram node has completed.

Keep the Switch rules in this exact order:

1. `conversation_summary_ready`
2. `booking_offered`
3. `booking_clicked`
