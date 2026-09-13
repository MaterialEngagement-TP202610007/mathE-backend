export interface SchoolListFilters {
  /** Case-insensitive partial match against the school name (cenEdu). */
  search?: string;
  /** Case-insensitive partial match against the district (D_DIST). */
  district?: string;
}
