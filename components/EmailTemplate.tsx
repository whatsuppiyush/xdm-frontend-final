import React from 'react';

interface EmailTemplateProps {
  firstName: string;
}

export const EmailTemplate: React.FC<Readonly<EmailTemplateProps>> = ({
  firstName,
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
      background: 'linear-gradient(135deg, #1a1a1a 0%, #373737 100%)',
      padding: '40px 20px',
      borderRadius: '8px 8px 0 0',
      textAlign: 'center' as const,
    }}>
      <h1 style={{
        color: '#ffffff',
        fontSize: '28px',
        fontWeight: '700',
        margin: '0',
      }}>
        Welcome to XAutoDM
      </h1>
      <p style={{
        color: '#9ca3af',
        fontSize: '16px',
        marginTop: '8px',
      }}>
        Your Twitter Automation Journey Begins
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
        We&apos;re thrilled to welcome you to XAutoDM! You&apos;ve just taken the first step towards revolutionizing your Twitter outreach strategy.
      </p>

      {/* Features Section */}
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
          What you can do with XAutoDM:
        </h2>
        <div style={{ marginBottom: '16px' }}>
          {[
            {
              title: '🎯 Smart Campaign Management',
              desc: 'Create and manage targeted DM campaigns with ease'
            },
            {
              title: '📊 Advanced Analytics',
              desc: 'Track your campaign performance in real-time'
            },
            {
              title: '🤖 Automation Tools',
              desc: 'Save time with intelligent automation features'
            }
          ].map((feature, i) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <p style={{
                fontSize: '15px',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '4px',
              }}>
                {feature.title}
              </p>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: '0',
              }}>
                {feature.desc}
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
          href="https://xautodm.com"
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            padding: '12px 32px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '500',
            display: 'inline-block',
          }}
        >
          Get Started Now →
        </a>
      </div>

      <p style={{
        fontSize: '16px',
        lineHeight: '24px',
        color: '#374151',
      }}>
        Need help getting started? Our support team is here for you 24/7.
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
        This email was sent to you because you signed up for XAutoDM.
      </p>
    </div>
  </div>
); 