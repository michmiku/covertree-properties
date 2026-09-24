import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreatePropertyForm } from '@/features/properties/create-property-form';

export function NewPropertyRoute() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>New property</CardTitle>
        <CardDescription>
          US addresses only. Current weather and coordinates are added automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreatePropertyForm />
      </CardContent>
    </Card>
  );
}
