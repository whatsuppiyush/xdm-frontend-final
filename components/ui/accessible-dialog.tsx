// "use client";

// import * as React from "react";
// import { 
//   Dialog,
//   DialogContent,
//   DialogTitle,
//   DialogHeader
// } from "@/components/ui/dialog";
// import * as DialogPrimitive from "@radix-ui/react-dialog";

// /**
//  * AccessibleDialogContent - A wrapper around DialogContent that automatically adds a visually hidden
//  * DialogTitle to satisfy accessibility requirements without needing to modify every DialogContent usage.
//  */
// const AccessibleDialogContent = React.forwardRef<
//   React.ElementRef<typeof DialogContent>,
//   React.ComponentPropsWithoutRef<typeof DialogContent>
// >(({ children, ...props }, ref) => {
//   // Check if children already contain a DialogTitle
//   const hasDialogTitle = React.Children.toArray(children).some((child) => {
//     if (React.isValidElement(child)) {
//       // Check if the child is a DialogHeader that contains a DialogTitle
//       if (child.type === DialogHeader) {
//         return React.Children.toArray(child.props.children).some(
//           (headerChild) => React.isValidElement(headerChild) && headerChild.type === DialogTitle
//         );
//       }
//       // Check if the child itself is a DialogTitle
//       return child.type === DialogTitle;
//     }
//     return false;
//   });

//   return (
//     <DialogContent ref={ref} {...props}>
//       {!hasDialogTitle && (
//         <DialogHeader className="sr-only">
//           <DialogTitle>Dialog</DialogTitle>
//         </DialogHeader>
//       )}
//       {children}
//     </DialogContent>
//   );
// });

// AccessibleDialogContent.displayName = "AccessibleDialogContent";

// export { AccessibleDialogContent };
