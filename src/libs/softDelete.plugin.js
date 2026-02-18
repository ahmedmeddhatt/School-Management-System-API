const mongoose = require('mongoose');

/**
 * Mongoose plugin — adds soft-delete behaviour to any schema.
 *
 * Fields added:
 *   deletedAt  : Date   (null = active)
 *   deletedBy  : ObjectId (actor who deleted)
 *
 * All find/findOne/findOneAndUpdate queries automatically filter
 * { deletedAt: null } unless the caller already specifies deletedAt.
 *
 * Statics added:
 *   Model.softDelete(id, actorId)  — soft-deletes one document
 *   Model.restore(id)              — un-deletes one document
 *   Model.findWithDeleted(filter)  — bypasses the auto-filter
 */
module.exports = function softDeletePlugin(schema) {
  schema.add({
    deletedAt: { type: Date,                                 default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  });

  // ── Query middleware — auto-exclude soft-deleted docs ──────────────────────
  const HOOKS = ['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'count'];

  HOOKS.forEach((hook) => {
    schema.pre(hook, function () {
      const filter = this.getFilter();
      if (!Object.prototype.hasOwnProperty.call(filter, 'deletedAt')) {
        this.where({ deletedAt: null });
      }
    });
  });

  // ── Statics ────────────────────────────────────────────────────────────────
  schema.statics.softDelete = async function (id, actorId) {
    return this.findByIdAndUpdate(
      id,
      { $set: { deletedAt: new Date(), deletedBy: actorId ?? null } },
      { new: true }
    );
  };

  schema.statics.restore = async function (id) {
    // Must bypass auto-filter to find a deleted document
    return this.findOneAndUpdate(
      { _id: id, deletedAt: { $ne: null } },
      { $set: { deletedAt: null, deletedBy: null } },
      { new: true }
    );
  };

  schema.statics.findWithDeleted = function (filter = {}) {
    // Explicitly include deletedAt in filter to bypass pre-hook
    return this.find({ deletedAt: { $exists: true }, ...filter });
  };
};
