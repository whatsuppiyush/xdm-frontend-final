interface LeadListCardProps {
  id: string;
  name: string;
  leadCount: number;
  onCreateAutomation: () => void;
  onDelete: (id: string) => void;
}

export default function LeadListCard({
  id,
  name,
  leadCount,
  onCreateAutomation,
  onDelete,
}: LeadListCardProps) {
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this lead list?')) {
      onDelete(id);
    }
  };

  return (
    <div className="border-2 rounded-lg" data-oid="wapobin">
      <div className="p-4 space-y-1" data-oid="95quu_9">
        <h3 className="font-medium" data-oid="_m2lhe0">
          {name}
        </h3>
        <p className="text-sm text-gray-600" data-oid="2d74v4h">
          {leadCount} leads
        </p>
      </div>
      <div className="grid grid-cols-2 border-t-2" data-oid="vzmm29p">
        <button
          onClick={onCreateAutomation}
          className="p-2 text-center hover:bg-gray-50 text-sm border-r-2"
          data-oid="p42od1-"
        >
          Create Automation
        </button>
        <button
          onClick={handleDelete}
          className="p-2 text-center hover:bg-gray-50 text-sm text-red-600"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
