import * as React from 'react';

interface LeadScrapingCompleteEmailTemplateProps {
  firstName: string;
  leadCount: number;
  listName: string;
}

export const LeadScrapingCompleteEmailTemplate: React.FC<Readonly<LeadScrapingCompleteEmailTemplateProps>> = ({
  firstName,
  leadCount,
  listName,
}) => (
  <div style={{
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
  }}>
    {/* Header */}
    <div style={{
      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      padding: '40px 20px',
      borderRadius: '8px 8px 0 0',
      textAlign: 'center' as const,
    }}>
      <h1 style={{
        color: '#ffffff',
        fontSize: '28px',
        fontWeight: '700',
        margin: '0',
        letterSpacing: '-0.5px',
      }}>
        Your Leads Are Ready!
      </h1>
      <p style={{
        color: '#e0e7ff',
        fontSize: '16px',
        marginTop: '8px',
      }}>
        {listName} has been successfully created
      </p>
    </div>

    {/* Main Content */}
    <div style={{
      padding: '40px 32px',
      backgroundColor: '#ffffff',
    }}>
      <p style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#374151',
        marginBottom: '24px',
      }}>
        Hi {firstName},
      </p>
      <p style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#374151',
        marginBottom: '24px',
      }}>
        Great news! We&apos;ve successfully completed scraping leads for your list <strong>{listName}</strong>. Your new lead list is now ready for your campaigns.
      </p>

      {/* Lead Stats Section */}
      <div style={{
        backgroundColor: '#eef2ff',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #c7d2fe',
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#4f46e5',
          marginBottom: '16px',
        }}>
          Lead List Details:
        </h2>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: '#374151' }}>List Name:</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#4f46e5' }}>{listName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: '#374151' }}>Total Leads:</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#4f46e5' }}>{leadCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#374151' }}>Status:</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#4f46e5' }}>Ready to Use</span>
          </div>
        </div>
      </div>

      {/* Next Steps Section */}
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '16px',
        }}>
          Next Steps:
        </h2>
        <div style={{ marginBottom: '16px' }}>
          {[
            {
              title: '📋 Review Your Leads',
              desc: 'Check your new leads and their profiles'
            },
            {
              title: '🎯 Create a Campaign',
              desc: 'Start engaging with your new leads through a targeted campaign'
            },
            {
              title: '📊 Track Performance',
              desc: 'Monitor your campaign engagement and results'
            }
          ].map((step, i) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <p style={{
                fontSize: '15px',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '4px',
              }}>
                {step.title}
              </p>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: '0',
              }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div style={{
        textAlign: 'center' as const,
        marginBottom: '32px',
      }}>
        <a
          href="https://app.xautodm.com/leads"
          style={{
            backgroundColor: '#4f46e5',
            color: '#ffffff',
            padding: '12px 32px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '500',
            display: 'inline-block',
          }}
        >
          View Lead List →
        </a>
      </div>

      <p style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#374151',
      }}>
        Need help creating your first campaign? Our support team is ready to assist you.
      </p>
      <p style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#374151',
        marginTop: '24px',
      }}>
        Best regards,<br />
        The XAutoDM Team
      </p>
    </div>

    {/* Footer */}
    <div style={{
      borderTop: '1px solid #e5e7eb',
      padding: '24px 32px',
      textAlign: 'center' as const,
    }}>
      <p style={{
        fontSize: '13px',
        color: '#6b7280',
        margin: '0',
      }}>
        © {new Date().getFullYear()} XAutoDM. All rights reserved.
      </p>
      <p style={{
        fontSize: '13px',
        color: '#6b7280',
        marginTop: '8px',
      }}>
        You received this email because you have an active account with XAutoDM.
      </p>
    </div>
  </div>
); 