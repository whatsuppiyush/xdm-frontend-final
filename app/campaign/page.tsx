import { Heading } from "@/components/heading";
import LeadLists from '@/components/leads/lead-lists';

export default function CampaignPage() {
  return (
    <div>
      <Heading
        title="Campaign"
        description="View and manage your message campaigns"
      />
      <div className="px-4 lg:px-8">
        <LeadLists />
      </div>
    </div>
  );
} 