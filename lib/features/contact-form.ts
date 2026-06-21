// Contact Form with Email Automation
// This file implements the contact form functionality with email automation

import { useState } from 'react';

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: 'general' | 'support' | 'sales' | 'partnership' | 'other';
}

export interface ContactFormResponse {
  success: boolean;
  message: string;
  ticketId?: string;
}

class ContactFormSystem {
  /**
   * Validate contact form data
   */
  validate(data: ContactFormData): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    if (!data.name || data.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (!data.email || !this.validateEmail(data.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!data.subject || data.subject.trim().length < 3) {
      errors.subject = 'Subject must be at least 3 characters';
    }

    if (!data.message || data.message.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Submit contact form
   */
  async submit(data: ContactFormData): Promise<ContactFormResponse> {
    const validation = this.validate(data);
    if (!validation.isValid) {
      return {
        success: false,
        message: 'Please fix the errors in the form',
      };
    }

    // Generate ticket ID
    const ticketId = this.generateTicketId();

    // In production, save to database and send email
    await this.saveToDatabase(data, ticketId);
    await this.sendEmailNotification(data, ticketId);
    await this.sendAutoReply(data.email, ticketId);

    return {
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon.',
      ticketId,
    };
  }

  /**
   * Get contact form categories
   */
  getCategories(): Array<{ value: string; label: string; labelAr: string }> {
    return [
      { value: 'general', label: 'General Inquiry', labelAr: 'استفسار عام' },
      { value: 'support', label: 'Technical Support', labelAr: 'الدعم الفني' },
      { value: 'sales', label: 'Sales Inquiry', labelAr: 'استفسار مبيعات' },
      { value: 'partnership', label: 'Partnership', labelAr: 'شراكة' },
      { value: 'other', label: 'Other', labelAr: 'أخرى' },
    ];
  }

  /**
   * Get ticket status
   */
  async getTicketStatus(ticketId: string): Promise<{ status: string; updatedAt: Date }> {
    // In production, query database
    return {
      status: 'pending',
      updatedAt: new Date(),
    };
  }

  /**
   * Generate ticket ID
   */
  private generateTicketId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ZOR-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Validate email
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Save to database
   */
  private async saveToDatabase(data: ContactFormData, ticketId: string): Promise<void> {
    // In production, save to database
    console.log('Saving contact form:', { data, ticketId });
  }

  /**
   * Send email notification to admin
   */
  private async sendEmailNotification(data: ContactFormData, ticketId: string): Promise<void> {
    // In production, send email using SMTP service
    const emailContent = {
      to: 'support@zorino.com',
      subject: `New Contact Form Submission - ${ticketId}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Ticket ID:</strong> ${ticketId}</p>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Category:</strong> ${data.category || 'general'}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <p><strong>Message:</strong></p>
        <p>${data.message}</p>
        <hr>
        <p><small>Sent from ZORINO Contact Form</small></p>
      `,
    };

    console.log('Sending email notification:', emailContent);
  }

  /**
   * Send auto-reply to user
   */
  private async sendAutoReply(email: string, ticketId: string): Promise<void> {
    // In production, send email using SMTP service
    const emailContent = {
      to: email,
      subject: `Thank you for contacting ZORINO - ${ticketId}`,
      html: `
        <h2>Thank you for contacting us!</h2>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <p><strong>Ticket ID:</strong> ${ticketId}</p>
        <p>Please keep this ticket ID for your reference.</p>
        <hr>
        <p>Best regards,<br>The ZORINO Team</p>
      `,
    };

    console.log('Sending auto-reply:', emailContent);
  }
}

export const contactFormSystem = new ContactFormSystem();

// React hook for contact form
export function useContactForm() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ContactFormResponse | null>(null);

  const submit = async (data: ContactFormData) => {
    setLoading(true);
    const result = await contactFormSystem.submit(data);
    setResponse(result);
    setLoading(false);
    return result;
  };

  const getCategories = () => {
    return contactFormSystem.getCategories();
  };

  const getTicketStatus = async (ticketId: string) => {
    return await contactFormSystem.getTicketStatus(ticketId);
  };

  return {
    loading,
    response,
    submit,
    getCategories,
    getTicketStatus,
  };
}
