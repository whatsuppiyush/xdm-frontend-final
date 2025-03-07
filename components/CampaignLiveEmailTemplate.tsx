import * as React from 'react';

interface CampaignLiveEmailTemplateProps {
  firstName: string;
  campaignName: string;
  recipientCount: number;
}

export const CampaignLiveEmailTemplate: React.FC<Readonly<CampaignLiveEmailTemplateProps>> = ({
  firstName,
  campaignName,
  recipientCount,
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
      background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
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
        Your Campaign Is Live!
      </h1>
      <p style={{
        color: '#d1fae5',
        fontSize: '16px',
        marginTop: '8px',
      }}>
        {campaignName} is now reaching your audience
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
        Congratulations! Your first campaign <strong>{campaignName}</strong> is now live and running. Your message is being delivered to {recipientCount} recipients.
      </p>

      {/* Campaign Stats Section */}
      <div style={{
        backgroundColor: '#f0fdfa',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #99f6e4',
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#0f766e',
          marginBottom: '16px',
        }}>
          Campaign Details:
        </h2>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: '#374151' }}>Campaign Name:</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f766e' }}>{campaignName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: '#374151' }}>Recipients:</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f766e' }}>{recipientCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: '#374151' }}>Status:</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f766e' }}>Running</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#374151' }}>Started:</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f766e' }}>{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Tips Section */}
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
          Tips for Campaign Success:
        </h2>
        <div style={{ marginBottom: '16px' }}>
          {[
            {
              title: '📊 Monitor Performance',
              desc: 'Check your dashboard regularly to track engagement metrics'
            },
            {
              title: '⏱️ Be Patient',
              desc: 'Messages are sent gradually to maintain natural engagement patterns'
            },
            {
              title: '🔄 Iterate & Improve',
              desc: 'Use insights from this campaign to optimize future outreach'
            }
          ].map((tip, i) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <p style={{
                fontSize: '15px',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '4px',
              }}>
                {tip.title}
              </p>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: '0',
              }}>
                {tip.desc}
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
          href="https://xcolddm.com/campaign"
          style={{
            backgroundColor: '#0d9488',
            color: '#ffffff',
            padding: '12px 32px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '500',
            display: 'inline-block',
          }}
        >
          View Campaign Dashboard →
        </a>
      </div>

      <p style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#374151',
      }}>
        Need help optimizing your campaign? Our support team is ready to assist you.
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
        You received this email because you have an active campaign with XAutoDM.
      </p>
    </div>
  </div>
); 