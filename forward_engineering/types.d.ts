export type ColumnDefinition = {
  name: string;
  type: string;
  isActivated: boolean;
  length?: number;
  precision?: number;
  primaryKey?: boolean;
  scale?: number;
  timePrecision?: number;
  unique?: boolean;
};

export type KeyType = 'PRIMARY KEY' | 'UNIQUE' | 'CHECK';

export type ConstraintDto = {
  keyType: KeyType;
  expression?: string;
};

export type JsonSchema = Record<string, unknown>;
