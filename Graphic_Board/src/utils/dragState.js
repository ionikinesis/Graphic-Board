// Module-level drag payload — FileSystemHandle objects can't be serialised
// into DataTransfer, so we store them here during a drag operation.
// { kind: 'file'|'directory', name, handle, parentHandle }
let _payload = null
export const setDragPayload   = p  => { _payload = p }
export const getDragPayload   = () => _payload
export const clearDragPayload = () => { _payload = null }
