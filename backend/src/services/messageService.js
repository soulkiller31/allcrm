import config from '../config/index.js';

export const interpolateTemplate = (content, customer, salonName) => {
  const replacements = {
    '{{name}}': customer.name || '',
    '{{phone}}': customer.phone || '',
    '{{email}}': customer.email || '',
    '{{salon_name}}': salonName || config.salonName,
    '{{birthday}}': customer.birthday || '',
    '{{anniversary}}': customer.anniversary || '',
    '{{last_visit}}': customer.last_visit || '',
  };

  let message = content;
  for (const [key, value] of Object.entries(replacements)) {
    message = message.replaceAll(key, value);
  }
  return message;
};

export const normalizePhone = (phone) => {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
};

export const formatPhoneForWhatsApp = (phone) => {
  const cleaned = normalizePhone(phone);
  return `${cleaned}@c.us`;
};
