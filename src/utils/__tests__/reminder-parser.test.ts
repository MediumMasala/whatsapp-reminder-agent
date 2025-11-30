import { ReminderParser } from '../reminder-parser';

describe('ReminderParser', () => {
  let parser: ReminderParser;

  beforeEach(() => {
    parser = new ReminderParser('Asia/Kolkata');
  });

  describe('parse', () => {
    it('should parse "tomorrow at 9am"', () => {
      const result = parser.parse('Remind me tomorrow at 9am to call doctor');

      expect(result).not.toBeNull();
      expect(result?.text).toBe('call doctor');
      expect(result?.scheduledTime.getHours()).toBe(9);
      expect(result?.scheduledTime.getMinutes()).toBe(0);
    });

    it('should parse "7pm today"', () => {
      const result = parser.parse('Pay rent at 7pm');

      expect(result).not.toBeNull();
      expect(result?.text).toContain('Pay rent');
      expect(result?.scheduledTime.getHours()).toBe(19);
    });

    it('should parse "tomorrow morning"', () => {
      const result = parser.parse('Meeting tomorrow morning');

      expect(result).not.toBeNull();
      expect(result?.text).toBe('Meeting');
      expect(result?.scheduledTime.getHours()).toBe(9);
    });

    it('should parse "5:30pm"', () => {
      const result = parser.parse('Remind me at 5:30pm to workout');

      expect(result).not.toBeNull();
      expect(result?.scheduledTime.getHours()).toBe(17);
      expect(result?.scheduledTime.getMinutes()).toBe(30);
    });

    it('should return null for messages without time', () => {
      const result = parser.parse('Hello how are you');

      expect(result).toBeNull();
    });

    it('should handle "tomorrow evening"', () => {
      const result = parser.parse('Call mom tomorrow evening');

      expect(result).not.toBeNull();
      expect(result?.text).toBe('Call mom');
      expect(result?.scheduledTime.getHours()).toBe(18);
    });
  });

  describe('isReminderRequest', () => {
    it('should detect reminder keywords', () => {
      expect(parser.isReminderRequest('Remind me to do something')).toBe(true);
      expect(parser.isReminderRequest('Set a reminder for tomorrow')).toBe(true);
    });

    it('should detect time expressions', () => {
      expect(parser.isReminderRequest('Call at 5pm')).toBe(true);
      expect(parser.isReminderRequest('Tomorrow morning meeting')).toBe(true);
    });

    it('should return false for non-reminder messages', () => {
      expect(parser.isReminderRequest('Hello')).toBe(false);
      expect(parser.isReminderRequest('How are you?')).toBe(false);
    });
  });

  describe('extractReminderText', () => {
    it('should clean up reminder text', () => {
      const result = parser.parse('Remind me at 7pm to pay rent');

      expect(result?.text).toBe('pay rent');
    });

    it('should handle text without separators', () => {
      const result = parser.parse('Meeting tomorrow at 10am');

      expect(result?.text).toBe('Meeting');
    });
  });
});
