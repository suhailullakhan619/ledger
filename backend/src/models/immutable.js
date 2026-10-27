const BLOCKED_QUERY_OPS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
];

/**
 * Mongoose plugin that makes documents append-only: once created they can never
 * be updated or deleted through the model.
 */
function immutablePlugin(schema, { name }) {
  const error = () => new Error(`${name} are immutable and cannot be modified or deleted`);

  schema.pre(BLOCKED_QUERY_OPS, { document: false, query: true }, function blockQuery() {
    throw error();
  });

  schema.pre(['deleteOne', 'updateOne'], { document: true, query: false }, function blockDocument() {
    throw error();
  });

  schema.pre('save', function blockResave() {
    if (!this.isNew) throw error();
  });

  schema.pre('bulkWrite', function blockBulk() {
    throw error();
  });
}

module.exports = { immutablePlugin };
