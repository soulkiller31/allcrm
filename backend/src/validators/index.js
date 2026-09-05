import { body } from 'express-validator';

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const customerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone')
    .trim()
    .notEmpty()
    .matches(/^[\d+\-\s()]{10,15}$/)
    .withMessage('Valid phone number is required'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Valid email required'),
  body('birthday').optional({ nullable: true }).isISO8601().withMessage('Invalid birthday date'),
  body('anniversary').optional({ nullable: true }).isISO8601().withMessage('Invalid anniversary date'),
  body('last_visit').optional({ nullable: true }).isISO8601().withMessage('Invalid last visit date'),
  body('gender').optional({ nullable: true }).isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('address').optional({ nullable: true }).trim(),
  body('gstin').optional({ nullable: true }).trim(),
];

export const invoiceSaveValidation = [
  body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer.phone')
    .trim()
    .notEmpty()
    .matches(/^[\d+\-\s()]{10,15}$/)
    .withMessage('Valid phone number is required'),
  body('customer.email').optional({ nullable: true }).isEmail().withMessage('Valid email required'),
  body('customer.address').optional({ nullable: true }).trim(),
  body('customer.gstin').optional({ nullable: true }).trim(),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.description').trim().notEmpty().withMessage('Item description is required'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Valid quantity required'),
  body('items.*.price').isFloat({ min: 0 }).withMessage('Valid price required'),
  body('discount').optional().isFloat({ min: 0 }),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
  body('send_whatsapp').optional().isBoolean(),
];

export const templateValidation = [
  body('type')
    .isIn(['birthday', 'anniversary', 'monthly_offer', 'follow_up', 'follow_up_female', 'follow_up_male'])
    .withMessage('Invalid template type'),
  body('name').trim().notEmpty().withMessage('Template name is required'),
  body('content').trim().notEmpty().withMessage('Template content is required'),
  body('is_active').optional().isBoolean(),
];

export const testMessageValidation = [
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
];

export const manualMessageValidation = [
  body('customer_id').isUUID().withMessage('Valid customer ID required'),
  body('template_id').isUUID().withMessage('Valid template ID required'),
];
