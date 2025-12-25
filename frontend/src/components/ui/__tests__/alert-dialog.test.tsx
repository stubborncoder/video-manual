import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '../alert-dialog';
import { Button } from '../button';

describe('AlertDialog Component', () => {
  describe('Opens on Trigger', () => {
    it('should open alert dialog when trigger is clicked', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Delete Item</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      // Alert dialog content should not be visible initially
      expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();

      // Click the trigger
      await user.click(screen.getByText('Delete Item'));

      // Alert dialog content should now be visible
      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
        expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
      });
    });

    it('should render trigger as custom element', () => {
      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button data-testid="custom-trigger">Custom Trigger</button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Alert</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      );

      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
    });

    it('should support controlled open state', async () => {
      const { rerender } = render(
        <AlertDialog open={false}>
          <AlertDialogContent>
            <AlertDialogTitle>Controlled Alert</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      );

      expect(screen.queryByText('Controlled Alert')).not.toBeInTheDocument();

      rerender(
        <AlertDialog open={true}>
          <AlertDialogContent>
            <AlertDialogTitle>Controlled Alert</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      );

      await waitFor(() => {
        expect(screen.getByText('Controlled Alert')).toBeInTheDocument();
      });
    });
  });

  describe('Closes on Cancel', () => {
    it('should close alert dialog when cancel button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open Alert</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      // Open the dialog
      await user.click(screen.getByText('Open Alert'));

      await waitFor(() => {
        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      });

      // Click cancel
      await user.click(screen.getByText('Cancel'));

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
      });
    });

    it('should not close when clicking overlay (unlike regular dialog)', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open Alert</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Important Alert</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      // Open the dialog
      await user.click(screen.getByText('Open Alert'));

      await waitFor(() => {
        expect(screen.getByText('Important Alert')).toBeInTheDocument();
      });

      // Click the overlay - alert dialog should NOT close (by default)
      const overlay = document.querySelector('[data-slot="alert-dialog-overlay"]');
      if (overlay) {
        await user.click(overlay);

        // Alert dialog should still be visible
        // (AlertDialog is designed to require explicit action)
        await waitFor(() => {
          expect(screen.getByText('Important Alert')).toBeInTheDocument();
        });
      }
    });

    it('should apply outline variant styling to cancel button', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Test</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="cancel-btn">Cancel</AlertDialogCancel>
              <AlertDialogAction>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        const cancelBtn = screen.getByTestId('cancel-btn');
        // Cancel button should have outline variant styling
        expect(cancelBtn.className).toMatch(/border/);
      });
    });
  });

  describe('Calls onConfirm (AlertDialogAction)', () => {
    it('should call action handler when action button is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Delete</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Item?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the item.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      // Open the dialog
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(screen.getByText('Delete Item?')).toBeInTheDocument();
      });

      // Click the action button (Delete in footer)
      const deleteButtons = screen.getAllByText('Delete');
      const actionButton = deleteButtons[deleteButtons.length - 1];
      await user.click(actionButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should close dialog after action is clicked', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Confirm</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel>No</AlertDialogCancel>
              <AlertDialogAction>Yes</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Yes'));

      await waitFor(() => {
        expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
      });
    });

    it('should handle async action operations', async () => {
      const user = userEvent.setup();
      const onAction = jest.fn().mockResolvedValue(undefined);

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Async Action</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                await onAction();
              }}>
                Confirm Async
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByText('Async Action')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Confirm Async'));

      await waitFor(() => {
        expect(onAction).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Escape', () => {
    it('should close alert dialog when Escape key is pressed', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open Alert</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Escapable Alert</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      // Open the dialog
      await user.click(screen.getByText('Open Alert'));

      await waitFor(() => {
        expect(screen.getByText('Escapable Alert')).toBeInTheDocument();
      });

      // Press Escape
      await user.keyboard('{Escape}');

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText('Escapable Alert')).not.toBeInTheDocument();
      });
    });

    it('should call onOpenChange with false when Escape is pressed', async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();

      render(
        <AlertDialog open={true} onOpenChange={onOpenChange}>
          <AlertDialogContent>
            <AlertDialogTitle>Test Alert</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Alert')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('AlertDialog Structure', () => {
    it('should render header correctly', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader data-testid="alert-header">
              <AlertDialogTitle>Header Title</AlertDialogTitle>
              <AlertDialogDescription>Header Description</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByTestId('alert-header')).toBeInTheDocument();
        expect(screen.getByText('Header Title')).toBeInTheDocument();
        expect(screen.getByText('Header Description')).toBeInTheDocument();
      });
    });

    it('should render footer correctly', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogFooter data-testid="alert-footer">
              <AlertDialogCancel>No Thanks</AlertDialogCancel>
              <AlertDialogAction>Proceed</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByTestId('alert-footer')).toBeInTheDocument();
        expect(screen.getByText('No Thanks')).toBeInTheDocument();
        expect(screen.getByText('Proceed')).toBeInTheDocument();
      });
    });
  });

  describe('Button Styling', () => {
    it('should apply default button variant to action', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Test</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction data-testid="action-btn">Action</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        const actionBtn = screen.getByTestId('action-btn');
        // Action button should have default/primary styling
        expect(actionBtn.className).toMatch(/bg-primary|bg-/);
      });
    });

    it('should support custom className on action and cancel', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Custom Styles</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel className="custom-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction className="custom-action">OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toHaveClass('custom-cancel');
        expect(screen.getByText('OK')).toHaveClass('custom-action');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria role', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open Alert</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Accessible Alert</AlertDialogTitle>
              <AlertDialogDescription>This alert is accessible</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Open Alert'));

      await waitFor(() => {
        const dialog = screen.getByRole('alertdialog');
        expect(dialog).toBeInTheDocument();
      });
    });

    it('should have proper heading structure', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Alert Title</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByText('Alert Title')).toBeInTheDocument();
      });
    });

    it('should trap focus within alert dialog', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Focus Trap Test</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByText('Focus Trap Test')).toBeInTheDocument();
      });

      // Tab through elements
      await user.tab();
      await user.tab();

      // Focus should be within the dialog
      const activeElement = document.activeElement;
      const dialogContent = document.querySelector('[data-slot="alert-dialog-content"]');
      expect(dialogContent?.contains(activeElement)).toBe(true);
    });
  });

  describe('Data Slots', () => {
    it('should have correct data-slot attributes', async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Open</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Slots Test</AlertDialogTitle>
              <AlertDialogDescription>Testing slots</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeInTheDocument();
        expect(document.querySelector('[data-slot="alert-dialog-overlay"]')).toBeInTheDocument();
        expect(document.querySelector('[data-slot="alert-dialog-header"]')).toBeInTheDocument();
        expect(document.querySelector('[data-slot="alert-dialog-title"]')).toBeInTheDocument();
        expect(document.querySelector('[data-slot="alert-dialog-description"]')).toBeInTheDocument();
        expect(document.querySelector('[data-slot="alert-dialog-footer"]')).toBeInTheDocument();
      });
    });
  });

  describe('Common Use Cases', () => {
    it('should work as a delete confirmation dialog', async () => {
      const user = userEvent.setup();
      const onDelete = jest.fn();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete Project</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the project and all its contents.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Project</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive">
                Yes, Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByText('Delete Project'));

      await waitFor(() => {
        expect(screen.getByText('Delete Project?')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Yes, Delete'));

      expect(onDelete).toHaveBeenCalled();
    });

    it('should work as a logout confirmation dialog', async () => {
      const user = userEvent.setup();
      const onLogout = jest.fn();

      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Logout</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign Out?</AlertDialogTitle>
              <AlertDialogDescription>
                You will need to sign in again to access your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay Signed In</AlertDialogCancel>
              <AlertDialogAction onClick={onLogout}>Sign Out</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      await user.click(screen.getByRole('button', { name: 'Logout' }));

      await waitFor(() => {
        expect(screen.getByText('Sign Out?')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Sign Out'));

      expect(onLogout).toHaveBeenCalled();
    });
  });
});
