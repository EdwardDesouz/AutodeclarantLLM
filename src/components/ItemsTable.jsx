export default function ItemsTable({ items, onChange }) {
  const updateItem = (idx, field, value) => {
    const next = items.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    onChange(next)
  }

  const removeItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  const addItem = () => {
    onChange([
      ...items,
      { description: '', hs_code: '', qty: '', unit_price: '', total_value: '' },
    ])
  }

  return (
    <div>
      <table className="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>HS Code</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td>
                <input
                  value={item.description ?? ''}
                  onChange={(e) => updateItem(idx, 'description', e.target.value)}
                />
              </td>
              <td>
                <input
                  className="hs-code"
                  value={item.hs_code ?? ''}
                  onChange={(e) => updateItem(idx, 'hs_code', e.target.value)}
                />
              </td>
              <td style={{ width: 52 }}>
                <input
                  value={item.qty ?? ''}
                  onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                />
              </td>
              <td style={{ width: 72 }}>
                <input
                  value={item.unit_price ?? ''}
                  onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                />
              </td>
              <td style={{ width: 72 }}>
                <input
                  value={item.total_value ?? ''}
                  onChange={(e) => updateItem(idx, 'total_value', e.target.value)}
                />
              </td>
              <td style={{ width: 28 }}>
                <button className="remove-item-btn" onClick={() => removeItem(idx)} title="Remove item">
                  &times;
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="add-item-btn" onClick={addItem}>+ Add item</button>
    </div>
  )
}
