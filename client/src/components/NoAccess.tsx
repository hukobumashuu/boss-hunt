export function NoAccess() {
  return (
    <div className="no-access">
      <p className="no-access__title">No valid link</p>
      <p className="no-access__body">
        This page needs the personal link whoever set this up sent you.
        If you had one before, it may have been rotated - ask them to send
        a new one.
      </p>
    </div>
  );
}
