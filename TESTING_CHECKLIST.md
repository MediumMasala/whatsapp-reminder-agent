# Internal Testing Checklist

Use this checklist to test your WhatsApp Reminder Agent.

## ✅ Initial Setup

- [ ] Meta Business Account created
- [ ] WhatsApp Business API added to app
- [ ] Test phone number obtained (free from Meta)
- [ ] Personal WhatsApp number verified
- [ ] Access token copied
- [ ] Phone Number ID copied
- [ ] Business Account ID copied
- [ ] `.env` file configured
- [ ] Local environment running (`npm run dev`)
- [ ] Ngrok running and URL copied
- [ ] Webhook configured in Meta dashboard
- [ ] Webhook subscribed to "messages"

## ✅ Basic Message Flow Tests

### Test 1: First Contact
- [ ] Send "Hello" to test number
- [ ] Receive help message response
- [ ] Check logs show message received
- [ ] Check database has user created
- [ ] Check conversation stored (inbound + outbound)

### Test 2: Help Command
- [ ] Send "Help"
- [ ] Receive help text with instructions
- [ ] Verify conversation logged

### Test 3: Simple Reminder - Time Only
- [ ] Send "Remind me at 7pm to call doctor"
- [ ] Receive confirmation message
- [ ] Check reminder in database (status: pending)
- [ ] Check scheduled time is correct (7pm today or tomorrow)
- [ ] Verify conversation logged with intent: create_reminder

### Test 4: Tomorrow Reminder
- [ ] Send "Remind me tomorrow at 9am to pay rent"
- [ ] Receive confirmation
- [ ] Verify scheduled time is tomorrow at 9am
- [ ] Check database

### Test 5: Natural Language - Morning/Evening
- [ ] Send "Tomorrow morning call mom"
- [ ] Receive confirmation (should be 9am)
- [ ] Send "Tomorrow evening workout"
- [ ] Receive confirmation (should be 6pm)

### Test 6: Time Format Variations
- [ ] Send "5:30pm - pick up groceries"
- [ ] Send "Meet at 10am tomorrow"
- [ ] Send "Pay bills at 7pm"
- [ ] All should create reminders correctly

## ✅ Conversation Context Tests

### Test 7: Context-Aware Response
- [ ] Send "Remind me to clean house"
- [ ] Receive "couldn't understand time" message
- [ ] Send "Tomorrow at 10am"
- [ ] System should use context to create reminder "clean house at 10am"
- [ ] Check conversation flow tracked correctly

### Test 8: Unknown Message Fallback
- [ ] Send random text: "What's the weather?"
- [ ] Receive fallback message with suggestions
- [ ] Verify logged as unknown intent

## ✅ List & Management Tests

### Test 9: List Reminders
- [ ] Create 3 different reminders
- [ ] Send "List my reminders"
- [ ] Receive list of all upcoming reminders
- [ ] Verify shows time in readable format

### Test 10: Empty List
- [ ] Cancel or wait for all reminders to complete
- [ ] Send "List my reminders"
- [ ] Receive "no upcoming reminders" message

### Test 11: Cancel Reminder (Basic)
- [ ] Send "Cancel reminder"
- [ ] Receive instructions to list first
- [ ] (Full cancellation by number - to be implemented)

## ✅ Reminder Delivery Tests

### Test 12: Immediate Reminder (2 minutes)
- [ ] Note current time (e.g., 3:00 PM)
- [ ] Send "Remind me at 3:02pm to test immediate"
- [ ] Wait 2 minutes
- [ ] Receive reminder notification at exactly 3:02pm
- [ ] Check reminder status changed to "sent"
- [ ] Check notification logged in conversations

### Test 13: Future Reminder
- [ ] Create reminder for tomorrow at specific time
- [ ] Verify it's in database with status "pending"
- [ ] Check BullMQ queue has the job scheduled
- [ ] (Wait until tomorrow to verify delivery)

### Test 14: Past Time Handling
- [ ] Send "Remind me at 9am to something" (if it's past 9am)
- [ ] Should schedule for tomorrow 9am (not today)
- [ ] Verify scheduled time is tomorrow

## ✅ Database & Conversation Memory Tests

### Test 15: User Creation
- [ ] Open Prisma Studio (`make prisma-studio`)
- [ ] Check Users table
- [ ] Verify your phone number exists
- [ ] Check timezone is Asia/Kolkata

### Test 16: Conversation History
- [ ] In Prisma Studio, open Conversations table
- [ ] Verify every message (inbound + outbound) is stored
- [ ] Check direction field (inbound/outbound)
- [ ] Check detectedIntent is populated
- [ ] Check extractedData has parsed time/date
- [ ] Verify relatedReminderId links to reminder

### Test 17: Reminder Metadata
- [ ] In Prisma Studio, open Reminders table
- [ ] Check metadata field
- [ ] Should have parsedTime, parsedDate, etc.
- [ ] Verify timestamps are correct

## ✅ Error Handling Tests

### Test 18: Invalid Time Format
- [ ] Send "Remind me asdfgh"
- [ ] Receive error message with format examples
- [ ] Verify logged as failed parse

### Test 19: Server Restart Recovery
- [ ] Create a reminder for 5 minutes from now
- [ ] Stop the app (Ctrl+C)
- [ ] Wait 1 minute
- [ ] Restart the app (`npm run dev`)
- [ ] Scheduler should re-queue the reminder
- [ ] Reminder should still send on time

### Test 20: Duplicate Job Prevention
- [ ] Create a reminder
- [ ] Restart app multiple times quickly
- [ ] Check BullMQ queue
- [ ] Should only have ONE job (job ID = reminder ID)

## ✅ Multi-User Tests (If You Have Multiple Numbers)

### Test 21: User Isolation
- [ ] Add second phone number to Meta dashboard
- [ ] Send message from number 1: Create reminder
- [ ] Send message from number 2: Create reminder
- [ ] Send "List" from number 1 - should only see their reminders
- [ ] Send "List" from number 2 - should only see their reminders
- [ ] Check database - separate user records

## ✅ Edge Cases

### Test 22: Very Long Reminder Text
- [ ] Send reminder with 500+ character text
- [ ] Should handle gracefully
- [ ] Check database stores full text

### Test 23: Special Characters
- [ ] Send "Remind me at 7pm to buy 🍕 & 🍔"
- [ ] Should handle emojis correctly
- [ ] Check database and delivery

### Test 24: Multiple Reminders Same Time
- [ ] Create 3 reminders for same time (2 mins from now)
- [ ] All should send at the right time
- [ ] All should update status to "sent"

## ✅ Performance Tests

### Test 25: Response Time
- [ ] Send message
- [ ] Response should arrive within 2-3 seconds
- [ ] Check logs for processing time

### Test 26: Queue Processing
- [ ] Create 10 reminders for 2 minutes from now
- [ ] All should process within a few seconds
- [ ] Check worker logs for concurrent processing

## ✅ Logging & Monitoring

### Test 27: Structured Logs
- [ ] Review console output
- [ ] Logs should be JSON formatted
- [ ] Should include userId, reminderId, etc.
- [ ] Different log levels (info, warn, error)

### Test 28: Health Check
- [ ] `curl http://localhost:3000/health`
- [ ] Should return `{"status":"ok","timestamp":"..."}`

### Test 29: Prisma Studio
- [ ] Run `make prisma-studio`
- [ ] Browse all tables
- [ ] Verify data relationships (users → reminders → conversations)

## 🐛 Known Limitations (Test These)

### Test 30: Test Number Restrictions
- [ ] Try messaging from unverified number
- [ ] Should NOT work (Meta restriction in test mode)
- [ ] Only verified numbers can interact

### Test 31: 24-Hour Session Window
- [ ] Don't message for 24+ hours
- [ ] Try to send reminder notification
- [ ] May require template message (future feature)

### Test 32: Access Token Expiry
- [ ] After 24 hours, token expires
- [ ] Reminders will fail to send
- [ ] Need to update with permanent token

## 📊 Metrics to Track

After testing, check:

- [ ] Total messages sent/received: ____
- [ ] Reminders created: ____
- [ ] Reminders sent successfully: ____
- [ ] Reminders failed: ____
- [ ] Average response time: ____ ms
- [ ] Conversation entries: ____
- [ ] Unique users: ____

## 🎯 Success Criteria

Your system is working if:

✅ All inbound messages get responses within 3 seconds
✅ Reminders are created with correct time (timezone-aware)
✅ Reminders send exactly at scheduled time (±30 seconds)
✅ Every message (in + out) is stored in conversations table
✅ Context-aware responses work
✅ System recovers from restarts
✅ No duplicate reminder sends
✅ Logs are clear and helpful

## 🚀 Next Steps After Testing

Once all tests pass:

1. **Get Permanent Access Token**
   - Replace temporary 24h token
   - See SETUP_WHATSAPP.md Step 10

2. **Add More Test Users**
   - Add up to 5 phone numbers in Meta dashboard
   - Get team feedback

3. **Monitor for a Week**
   - Check all reminders send correctly
   - Look for any errors in logs
   - Verify database growth is reasonable

4. **Plan Production**
   - Review DEPLOYMENT_CHECKLIST.md
   - Set up real domain and hosting
   - Get business verification from Meta

## 📝 Notes

Use this space to track issues found:

```
Date       | Issue                           | Status
-----------|--------------------------------|--------
           |                                |
           |                                |
           |                                |
```

---

**Testing Status**: _____ / 32 tests passed

**Tester**: _______________
**Date**: _______________
