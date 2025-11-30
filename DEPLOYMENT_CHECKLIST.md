# Deployment Checklist

Use this checklist when deploying to production.

## Pre-Deployment

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Set `NODE_ENV=production`
- [ ] Configure production `DATABASE_URL`
- [ ] Configure production Redis (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`)
- [ ] Set WhatsApp credentials (`WHATSAPP_ACCESS_TOKEN`, etc.)
- [ ] Set strong `WHATSAPP_WEBHOOK_SECRET`
- [ ] Set unique `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- [ ] Configure timezone if not Asia/Kolkata

### 2. Database Setup
- [ ] Provision PostgreSQL database (v16+)
- [ ] Run migrations: `npm run prisma:migrate`
- [ ] Verify database connection
- [ ] Set up automated backups
- [ ] Configure connection pooling

### 3. Redis Setup
- [ ] Provision Redis instance (v7+)
- [ ] Configure persistence (RDB + AOF)
- [ ] Set password (`REDIS_PASSWORD`)
- [ ] Test connection

### 4. Code Quality
- [ ] Run tests: `npm test`
- [ ] Build passes: `npm run build`
- [ ] No TypeScript errors
- [ ] Review and update dependencies

### 5. Security
- [ ] All secrets in environment variables (not code)
- [ ] Webhook signature verification enabled
- [ ] HTTPS enabled for webhook endpoint
- [ ] Database encryption at rest
- [ ] TLS for database connection
- [ ] Review CORS settings if needed

## Deployment

### 6. Docker Deployment
- [ ] Build Docker image: `docker build -t whatsapp-reminder .`
- [ ] Test image locally
- [ ] Push to container registry
- [ ] Deploy with `docker-compose up -d`
- [ ] Verify all services healthy

### 7. Network & DNS
- [ ] Domain configured (e.g., api.yourdomain.com)
- [ ] HTTPS certificate installed
- [ ] Webhook URL accessible publicly
- [ ] Health check endpoint responding (`GET /health`)

### 8. WhatsApp Configuration
- [ ] Webhook URL: `https://yourdomain.com/webhook`
- [ ] Webhook verified (verify token check)
- [ ] Subscribe to `messages` events
- [ ] Test message send/receive
- [ ] Configure message templates if needed

### 9. Monitoring & Logging
- [ ] Log aggregation configured
- [ ] Error alerting set up
- [ ] Health check monitoring
- [ ] Database metrics monitoring
- [ ] Redis metrics monitoring
- [ ] BullMQ dashboard (optional)

### 10. Scaling Configuration
- [ ] Set worker concurrency (default: 5)
- [ ] Configure rate limiting (default: 10 msg/sec)
- [ ] Set reminder check interval (default: 30s)
- [ ] Configure job retention policy

## Post-Deployment

### 11. Smoke Tests
- [ ] Send test reminder via WhatsApp
- [ ] Verify reminder created in database
- [ ] Wait for scheduled time, verify message sent
- [ ] Test "list reminders" command
- [ ] Test "help" command
- [ ] Check conversation history stored

### 12. Performance Verification
- [ ] Database query performance acceptable
- [ ] Redis response time < 10ms
- [ ] Webhook response time < 500ms
- [ ] Worker processing reminders on time

### 13. Monitoring Verification
- [ ] Logs appearing in log aggregator
- [ ] Alerts configured and tested
- [ ] Dashboards showing metrics
- [ ] Error tracking working

## Production Checklist

### Infrastructure
- [ ] Load balancer configured (if scaling horizontally)
- [ ] Auto-scaling rules set (if using)
- [ ] Backup strategy verified
- [ ] Disaster recovery plan documented

### Operations
- [ ] On-call rotation defined
- [ ] Runbooks created for common issues
- [ ] Access control configured
- [ ] Audit logging enabled

### Documentation
- [ ] API documentation updated
- [ ] Architecture diagram current
- [ ] Troubleshooting guide accessible
- [ ] Team trained on system

## Rollback Plan

In case of issues:

1. **Immediate**: Revert to previous Docker image
   ```bash
   docker-compose down
   docker-compose up -d --image previous-tag
   ```

2. **Database**: Have migration rollback ready
   ```bash
   npm run prisma:migrate -- --rollback
   ```

3. **WhatsApp**: Keep old webhook URL as backup

4. **Communication**: Notify users of any downtime

## Environment-Specific Settings

### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whatsapp_reminder
REDIS_HOST=localhost
```

### Staging
```env
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgresql://user:pass@staging-db:5432/whatsapp_reminder
REDIS_HOST=staging-redis
```

### Production
```env
NODE_ENV=production
LOG_LEVEL=warn
DATABASE_URL=postgresql://user:pass@prod-db:5432/whatsapp_reminder
REDIS_HOST=prod-redis
REDIS_PASSWORD=strong-password
```

## Common Issues & Solutions

### Issue: Webhook verification fails
**Solution**:
- Verify token matches exactly
- Check HTTPS is enabled
- Ensure URL is publicly accessible

### Issue: Reminders not sending
**Solution**:
- Check worker is running: `docker ps`
- Check Redis connection
- Review worker logs for errors
- Verify WhatsApp access token

### Issue: Database connection errors
**Solution**:
- Check connection string format
- Verify database is accessible
- Check connection pool size
- Review database logs

### Issue: High memory usage
**Solution**:
- Check for memory leaks in logs
- Review BullMQ job retention settings
- Optimize database queries
- Increase container memory limit

## Maintenance Windows

Schedule regular maintenance:

- [ ] Weekly: Review logs for errors
- [ ] Weekly: Check database size and performance
- [ ] Monthly: Update dependencies
- [ ] Monthly: Review and archive old conversations
- [ ] Quarterly: Load testing
- [ ] Quarterly: Security audit

## Success Metrics

Track these KPIs:

- **Uptime**: > 99.9%
- **Webhook response time**: < 500ms
- **Reminder delivery accuracy**: > 99.5%
- **Message delivery latency**: < 30 seconds
- **Error rate**: < 0.1%

## Sign-off

Deployment completed by: _______________
Date: _______________
Verified by: _______________
Date: _______________

---

**Last Updated**: January 2025
