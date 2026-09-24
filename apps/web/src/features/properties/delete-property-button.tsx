import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNavigate } from 'react-router';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DeletePropertyMutation } from './delete-property.mutation';

/** S6.6 — confirm, delete, then return to the list the user came from. */
export function DeletePropertyButton({
  id,
  address,
  returnTo,
}: {
  id: string;
  address: string;
  returnTo: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [deleteProperty, { loading }] = useMutation(DeletePropertyMutation, {
    // Drop the record from the cache whether it was deleted now or already gone, so neither the
    // list nor a revisited detail route can show it again (S6.6).
    update(cache) {
      cache.evict({ id: cache.identify({ __typename: 'Property', id }) });
      cache.gc();
    },
  });

  async function onConfirm() {
    setError(undefined);
    try {
      const { data } = await deleteProperty({ variables: { id } });
      // DeletePropertySuccess and PropertyNotFoundError both mean the property no longer exists.
      setOpen(false);
      if (data?.deleteProperty.__typename === 'PropertyNotFoundError') {
        toast.info('Property was already deleted', { description: address });
      } else {
        toast.success('Property deleted', { description: address });
      }
      await navigate(returnTo);
    } catch {
      setError('Could not reach the server. The property was not deleted.');
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return;
        setOpen(next);
        setError(undefined);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this property?</AlertDialogTitle>
          <AlertDialogDescription>
            {address} and its recorded weather will be removed. This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Keep property</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={loading}
            onClick={(event) => {
              // Stay open until the mutation settles so errors have somewhere to show.
              event.preventDefault();
              void onConfirm();
            }}
          >
            {loading ? 'Deleting…' : 'Delete property'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
