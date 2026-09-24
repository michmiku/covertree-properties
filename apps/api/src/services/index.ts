import type { CreateProperty } from './create-property.service.ts';
import type { DeleteProperty } from './delete-property.service.ts';
import type { GetProperty } from './get-property.service.ts';
import type { ListProperties } from './list-properties.service.ts';

/** Services resolvers may call (SPEC X1), built once in `server.ts`. */
export interface Services {
  createProperty: CreateProperty;
  deleteProperty: DeleteProperty;
  getProperty: GetProperty;
  listProperties: ListProperties;
}
