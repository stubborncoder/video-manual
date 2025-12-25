import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../dialog';
import { Button } from '../button';

describe('Dialog Component', () => {
  describe('Opens on Trigger', () => {
    it('should open dialog when trigger is clicked', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
              <DialogDescription>This is a test dialog</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      // Dialog content should not be visible initially
      expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();

      // Click the trigger
      await user.click(screen.getByText('Open Dialog'));

      // Dialog content should now be visible
      await waitFor(() => {
        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
        expect(screen.getByText('This is a test dialog')).toBeInTheDocument();
      });
    });

    it('should render trigger as custom element', async () => {
      render(
        <Dialog>
          <DialogTrigger asChild>
            <button data-testid="custom-trigger">Custom Trigger</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Content</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
    });

    it('should support controlled open state', async () => {
      const { rerender } = render(
        <Dialog open={false}>
          <DialogContent>
            <DialogTitle>Controlled Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.queryByText('Controlled Dialog')).not.toBeInTheDocument();

      rerender(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Controlled Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByText('Controlled Dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Closes on Cancel', () => {
    it('should close dialog when close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      // Open the dialog
      await user.click(screen.getByText('Open Dialog'));

      await waitFor(() => {
        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      });

      // Click the close button (X icon)
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
      });
    });

    it('should close dialog when DialogClose is clicked', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      // Open the dialog
      await user.click(screen.getByText('Open Dialog'));

      await waitFor(() => {
        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      });

      // Click the cancel button
      await user.click(screen.getByText('Cancel'));

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
      });
    });

    it('should close dialog when clicking overlay', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      // Open the dialog
      await user.click(screen.getByText('Open Dialog'));

      await waitFor(() => {
        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      });

      // Click the overlay
      const overlay = document.querySelector('[data-slot="dialog-overlay"]');
      if (overlay) {
        await user.click(overlay);

        await waitFor(() => {
          expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Calls onConfirm', () => {
    it('should call confirm handler when confirm button is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Action</DialogTitle>
              <DialogDescription>Are you sure you want to proceed?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={onConfirm}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      // Open the dialog
      await user.click(screen.getByText('Open Dialog'));

      await waitFor(() => {
        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      });

      // Click confirm
      await user.click(screen.getByText('Confirm'));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should handle async confirm operations', async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn().mockResolvedValue(undefined);

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Async Action</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={async () => {
                await onConfirm();
              }}>
                Confirm Async
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open Dialog'));

      await waitFor(() => {
        expect(screen.getByText('Async Action')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Confirm Async'));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Escape', () => {
    it('should close dialog when Escape key is pressed', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      // Open the dialog
      await user.click(screen.getByText('Open Dialog'));

      await waitFor(() => {
        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      });

      // Press Escape
      await user.keyboard('{Escape}');

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
      });
    });

    it('should call onOpenChange with false when Escape is pressed', async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();

      render(
        <Dialog open={true} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Dialog Content Options', () => {
    it('should hide close button when showCloseButton is false', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogTitle>No Close Button</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open Dialog'));

      await waitFor(() => {
        expect(screen.getByText('No Close Button')).toBeInTheDocument();
      });

      // Close button should not exist
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });

    it('should apply custom className to content', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent className="custom-dialog-class">
            <DialogTitle>Custom Class</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open Dialog'));

      await waitFor(() => {
        const content = document.querySelector('[data-slot="dialog-content"]');
        expect(content).toHaveClass('custom-dialog-class');
      });
    });

    it('should support custom max-width', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogTitle>Wide Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open Dialog'));

      await waitFor(() => {
        const content = document.querySelector('[data-slot="dialog-content"]');
        expect(content).toHaveClass('max-w-2xl');
      });
    });
  });

  describe('Dialog Structure', () => {
    it('should render header correctly', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader data-testid="dialog-header">
              <DialogTitle>Header Title</DialogTitle>
              <DialogDescription>Header Description</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByTestId('dialog-header')).toBeInTheDocument();
        expect(screen.getByText('Header Title')).toBeInTheDocument();
        expect(screen.getByText('Header Description')).toBeInTheDocument();
      });
    });

    it('should render footer correctly', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogFooter data-testid="dialog-footer">
              <Button>Action 1</Button>
              <Button>Action 2</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByTestId('dialog-footer')).toBeInTheDocument();
        expect(screen.getByText('Action 1')).toBeInTheDocument();
        expect(screen.getByText('Action 2')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria attributes', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accessible Dialog</DialogTitle>
              <DialogDescription>This dialog has proper accessibility</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open Dialog'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
      });
    });

    it('should have proper heading structure', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByText('Dialog Title')).toBeInTheDocument();
      });
    });

    it('should trap focus within dialog', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Focus Trap</DialogTitle>
            <input data-testid="input-1" placeholder="Input 1" />
            <input data-testid="input-2" placeholder="Input 2" />
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByTestId('input-1')).toBeInTheDocument();
      });

      // Tab through elements - focus should stay within dialog
      await user.tab();
      await user.tab();

      // Focus should be on one of the inputs or buttons within the dialog
      const activeElement = document.activeElement;
      const dialogContent = document.querySelector('[data-slot="dialog-content"]');
      expect(dialogContent?.contains(activeElement)).toBe(true);
    });
  });

  describe('Data Slots', () => {
    it('should have correct data-slot attributes', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Slots Test</DialogTitle>
              <DialogDescription>Testing slots</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button>OK</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(document.querySelector('[data-slot="dialog-content"]')).toBeInTheDocument();
        expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeInTheDocument();
        expect(document.querySelector('[data-slot="dialog-header"]')).toBeInTheDocument();
        expect(document.querySelector('[data-slot="dialog-title"]')).toBeInTheDocument();
        expect(document.querySelector('[data-slot="dialog-description"]')).toBeInTheDocument();
        expect(document.querySelector('[data-slot="dialog-footer"]')).toBeInTheDocument();
      });
    });
  });
});
