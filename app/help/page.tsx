export default function HelpPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Help & Support</h1>
      </div>
      
      <div className="grid gap-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Need Assistance?</h2>
          <p className="text-muted-foreground">
            Our support team is here to help you with any questions or issues you may have.
          </p>
          <div className="space-y-2">
            <p>Email: support@twitteroutreach.com</p>
            <p>Support Hours: Monday - Friday, 9 AM - 6 PM EST</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border p-6">
            <h3 className="font-semibold mb-2">Documentation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Explore our comprehensive guides and tutorials
            </p>
            <a href="#" className="text-primary hover:underline">
              View Documentation →
            </a>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="font-semibold mb-2">FAQs</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Find answers to commonly asked questions
            </p>
            <a href="#" className="text-primary hover:underline">
              Browse FAQs →
            </a>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="font-semibold mb-2">Contact Support</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get in touch with our support team
            </p>
            <a href="#" className="text-primary hover:underline">
              Submit Ticket →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}