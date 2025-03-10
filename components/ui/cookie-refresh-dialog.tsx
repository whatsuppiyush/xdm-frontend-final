import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";

interface CookieRefreshDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function CookieRefreshDialog({
  isOpen,
  onClose,
  onRefresh,
}: CookieRefreshDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Twitter Authentication Failed</AlertDialogTitle>
          <div className="text-sm text-muted-foreground">
            <p className="mb-4">
              Twitter authentication has expired. Please refresh your cookies to continue using the app.
            </p>
            
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-md text-amber-800">
              <h4 className="font-semibold mb-2 flex items-center">
                <RefreshCcw className="h-4 w-4 mr-2" /> Why this happens
              </h4>
              <div className="text-sm">
                Twitter cookies expire periodically for security reasons. You&apos;ll need to go to the Settings page 
                and update your Twitter account with fresh cookies.
              </div>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onRefresh();
            }}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Update Twitter Cookies
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 