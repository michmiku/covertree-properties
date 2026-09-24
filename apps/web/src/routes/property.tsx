import { useParams } from 'react-router';
import { PropertyDetails } from '@/features/properties/property-details';

export function PropertyRoute() {
  const { id = '' } = useParams();
  // Keyed so navigating between properties never shows the previous one's state.
  return <PropertyDetails key={id} id={id} />;
}
