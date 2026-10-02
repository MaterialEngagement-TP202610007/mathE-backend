import {
  ItemToValidate,
  ItemValidationBatch,
  ItemValidatorCatalog,
} from "../interfaces/item-validation/index.js";

export abstract class ItemValidatorAdapter {
  /**
   * Validates items against the external catalog. `bank` holds the statements
   * already stored, used to detect duplicates. Throws a CustomError when the
   * validator is unreachable or answers with an invalid payload.
   */
  abstract validate(
    items: ItemToValidate[],
    bank: string[],
  ): Promise<ItemValidationBatch>;

  /** Pings the validator so a cold instance is awake. Never throws. */
  abstract wakeUp(): Promise<boolean>;

  /** Returns the active rule catalog, or null when unavailable. Never throws. */
  abstract getCatalog(): Promise<ItemValidatorCatalog | null>;
}
