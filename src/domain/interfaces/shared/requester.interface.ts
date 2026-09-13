/** Authenticated caller identity passed from presentation into use cases. */
export interface Requester {
  id: number;
  roleId: number | null;
}
