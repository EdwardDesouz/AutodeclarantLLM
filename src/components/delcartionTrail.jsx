import { useState, useEffect } from "react";
import StatusStamp from "./StatusStamp";
import API from "../api/api";

const C = {
  panelBorder: "#c2d7e8",
  bar: "#0f3c52",
  barText: "#eaf3f9",
  navy: "#0b2f3f",
  sub: "#5c778a",
  inputBorder: "#b7c8d6",
  inputBg: "#ffffff",
  danger: "#c0392b",
  dangerBg: "#fdeceb",
  tableHead: "#0f3c52",
  rowAlt: "#f4f7fa",
  tabIdleBg: "#eef2f5",
};

function isPlainObject(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function formatLabel(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- helpers for grouping consecutive scalar fields into a 2-col grid ---
function isScalarValue(v) {
  return !Array.isArray(v) && !isPlainObject(v);
}

function groupEntries(entries) {
  const groups = [];
  let current = null;
  entries.forEach(([key, value]) => {
    if (isScalarValue(value)) {
      if (!current || current.type !== "scalar") {
        current = { type: "scalar", items: [] };
        groups.push(current);
      }
      current.items.push([key, value]);
    } else {
      groups.push({ type: "complex", items: [[key, value]] });
      current = null;
    }
  });
  return groups;
}

function ScalarFieldGrid({ items, path, onEdit, labelStyle }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "10px 14px",
        marginBottom: 14,
      }}
    >
      {items.map(([key, value]) => (
        <div key={key} className="decl-field-row">
          <span
            className="decl-field-label"
            style={{
              display: "block",
              marginBottom: 6,
              ...labelStyle,
            }}
          >
            {formatLabel(key)}
          </span>
          <span className="decl-field-value">
            <EditableValue
              value={value}
              path={[...path, key]}
              onEdit={onEdit}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

function renderGroupedEntries(
  entries,
  path,
  onEdit,
  { labelStyle, renderComplex },
) {
  const groups = groupEntries(entries);
  return groups.map((g, i) => {
    if (g.type === "scalar") {
      return (
        <ScalarFieldGrid
          key={`grp-${i}`}
          items={g.items}
          path={path}
          onEdit={onEdit}
          labelStyle={labelStyle}
        />
      );
    }
    const [key, value] = g.items[0];
    return renderComplex(key, value);
  });
}
// --- END GROUPING HELPERS ---

const ITEM_FIELD_SPECS = [
  {
    key: "code",
    label: "HS Code",
    aliases: ["code", "hscode", "hs_code", "commoditycode", "commodity_code"],
  },
  {
    key: "description",
    label: "Description",
    aliases: ["description", "desc"],
  },
  { key: "quantity", label: "Quantity", aliases: ["quantity", "qty"] },
  {
    key: "unitValue",
    label: "Unit Value",
    aliases: ["unitvalue", "unit_value", "unitprice"],
  },
  {
    key: "totalValue",
    label: "Total Value",
    aliases: ["totalvalue", "total_value"],
  },
  { key: "country", label: "Country", aliases: ["country"] },
  {
    key: "countryOfManufacture",
    label: "Country Of Manufacture",
    aliases: [
      "countryofmanufacture",
      "country_of_manufacture",
      "coo",
      "countryoforigin",
    ],
  },
];

function isItemsField(key) {
  return typeof key === "string" && key.trim().toLowerCase() === "items";
}

function isInvoiceField(key) {
  return typeof key === "string" && key.trim().toLowerCase() === "invoice";
}

function normalizeKey(k) {
  return String(k)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findRowKey(row, aliases) {
  const keys = Object.keys(row || {});
  return keys.find((k) => aliases.includes(normalizeKey(k)));
}

// Shipper/Receiver only — the declaration-flag fields (MessageType,
// DeclarationType, etc.) render on the Header tab instead, via
// HEADER_FIELD_SPECS below.
const PARTY_TOP_LEVEL_FIELDS = ["shipper", "receiver"];
const PARTY_TOP_LEVEL_FIELD_KEYS = PARTY_TOP_LEVEL_FIELDS.map(normalizeKey);

function isPartyField(key) {
  return (
    typeof key === "string" &&
    PARTY_TOP_LEVEL_FIELD_KEYS.includes(normalizeKey(key))
  );
}

// ---------------------------------------------------------------------------
// Master-data dropdown fetching — mirrors the pattern used elsewhere in the
// app (e.g. Header.jsx's fetchDeclarationTypeData / fetchCargoTypeData):
// GET the endpoint, expect an array of { Name: "..." } records, use the
// Name values as the dropdown's option list. Cached per-endpoint so
// switching tabs/emails doesn't refetch every time.
// ---------------------------------------------------------------------------
const masterOptionsCache = {};

function useMasterOptions(endpoint) {
  const [options, setOptions] = useState(
    () => masterOptionsCache[endpoint] || [],
  );

  useEffect(() => {
    if (!endpoint) return;
    if (masterOptionsCache[endpoint]) {
      setOptions(masterOptionsCache[endpoint]);
      return;
    }
    let cancelled = false;
    API.get(endpoint)
      .then((response) => {
        const list = (response.data || [])
          .map((item) => item?.Name)
          .filter(Boolean);
        masterOptionsCache[endpoint] = list;
        if (!cancelled) setOptions(list);
      })
      .catch((error) => {
        console.error(`Error fetching options from ${endpoint}`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return options;
}

// ---------------------------------------------------------------------------
// Header tab — fixed field list matching the real declaration form.
// Select fields pull their option list live from the same backend
// endpoints as the reference Header.jsx (Declaration Type, Cargo Pack
// Type, Inward Transport Mode, BG Indicator). `default` is what shows when
// n8n hasn't returned a value for that field at all — e.g. Declaration
// Type defaults to "GST : GST (Including Duty Exemption)" since that's the
// value used in the overwhelming majority of cases; it only changes when
// n8n's extracted data explicitly says otherwise.
// ---------------------------------------------------------------------------
const HEADER_FIELD_SPECS = [
  {
    key: "MessageType",
    label: "Message Type",
    type: "text",
    aliases: ["messagetype", "message_type"],
    default: "IPTDEC",
    disabled: true,
  },
  {
    key: "DeclarationType",
    label: "Declaration Type",
    type: "select",
    aliases: ["declarationtype", "declaration_type"],
    endpoint: "/getDeclarationTypeFromCommonMasterForInpayment/",
    default: "GST : GST (Including Duty Exemption)",
  },
  {
    key: "PreviousPermitNo",
    label: "Previous Permit No",
    type: "text",
    aliases: ["previouspermitno", "previous_permit_no"],
  },
  {
    key: "CargoPackType",
    label: "Cargo Pack Type",
    type: "select",
    aliases: ["cargopacktype", "cargo_pack_type"],
    endpoint: "/getCargoTypeFromCommonMaster/",
    default: "5 : Other Non-Containerized",
  },
  {
    key: "InwardTransportMode",
    label: "Inward Transport Mode",
    type: "select",
    aliases: ["inwardtransportmode", "inward_transport_mode"],
    endpoint: "/getInwardTransportModeFromCommonMaster/",
    default: "4 : Air",
  },
  {
    key: "BgIndicator",
    label: "BG Indicator",
    type: "select",
    aliases: ["bgindicator", "bg_indicator"],
    endpoint: "/getBgIndicatorFromCommonMaster/",
    default: "",
  },
  {
    key: "OverrideExgeRate",
    label: "Override Exge Rate",
    type: "checkbox",
    aliases: ["overrideexgerate", "override_exge_rate"],
  },
  {
    key: "SupplyIndicator",
    label: "Supply Indicator",
    type: "checkbox",
    aliases: ["supplyindicator", "supply_indicator"],
  },
  {
    key: "ReferenceDocument",
    label: "Reference Document",
    type: "checkbox",
    aliases: ["referencedocument", "reference_document"],
  },
];

const HEADER_FIELD_ALIAS_KEYS = HEADER_FIELD_SPECS.flatMap((s) =>
  s.aliases.map(normalizeKey),
);

function isHeaderField(key) {
  return (
    typeof key === "string" &&
    HEADER_FIELD_ALIAS_KEYS.includes(normalizeKey(key))
  );
}

// The select-type header fields whose values must keep their exact casing
// (as returned by the master-data endpoints, e.g. "GST : GST (Including
// Duty Exemption)") so they still match an <option> in the dropdown after
// being round-tripped through state. deepUpperCase() must skip these.
const HEADER_SELECT_KEYS = new Set(
  HEADER_FIELD_SPECS.filter((s) => s.type === "select").flatMap((s) => [
    normalizeKey(s.key),
    ...s.aliases.map(normalizeKey),
  ]),
);

function blankItemRow() {
  return Object.fromEntries(ITEM_FIELD_SPECS.map((s) => [s.key, ""]));
}

// HS codes can come back from n8n at 6, 7, 8, or more digits. Display rule:
// 6 or 7 digits -> show as-is; 8 digits -> show as-is; more than 8 -> show
// only the first 8. This only affects what's rendered — the full value the
// user typed or that n8n returned is still what gets saved.
function truncateHsCodeDisplay(v) {
  const s = String(v ?? "");
  return s.length > 8 ? s.slice(0, 8) : s;
}

function setDeep(obj, path, value) {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  if (Array.isArray(obj)) {
    const copy = obj.slice();
    copy[key] = setDeep(copy[key], rest, value);
    return copy;
  }
  const copy = { ...(obj || {}) };
  copy[key] = setDeep(copy[key], rest, value);
  return copy;
}

let hsCodeCache = null;

function useHsCodeSuggestions() {
  const [suggestions, setSuggestions] = useState(hsCodeCache || []);

  useEffect(() => {
    if (hsCodeCache) {
      setSuggestions(hsCodeCache);
      return;
    }
    let cancelled = false;
    API.get("/getCommonHsCodeTableInfo/")
      .then((response) => {
        hsCodeCache = response.data || [];
        if (!cancelled) setSuggestions(hsCodeCache);
      })
      .catch((error) => {
        console.error("Error fetching Hs Code suggestions", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return suggestions;
}

function EditableInput({
  value,
  onChange,
  placeholder,
  compact,
  onKeyDown,
  onFocus,
  onBlur,
}) {
  return (
    <input
      type="text"
      value={value ?? ""}
      placeholder={placeholder ?? ""}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        border: `1px solid ${C.inputBorder}`,
        borderRadius: 4,
        padding: compact ? "6px 8px" : "7px 9px",
        fontSize: compact ? 12.5 : 13,
        color: C.navy,
        background: C.inputBg,
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "inherit",
      }}
    />
  );
}

function HsCodeInput({ value, onChangeText, onSelect }) {
  const suggestions = useHsCodeSuggestions();
  const [showDropdown, setShowDropdown] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const [highlighted, setHighlighted] = useState(0);

  const runFilter = (val) => {
    if (!val) {
      setShowDropdown(false);
      setFiltered([]);
      return;
    }
    const matches = suggestions.filter(
      (i) =>
        i.HSCode?.toLowerCase().includes(val.toLowerCase()) ||
        i.Description?.toLowerCase().includes(val.toLowerCase()),
    );
    const exactMatch = matches.filter(
      (i) => i.HSCode?.toLowerCase() === val.toLowerCase(),
    );
    const finalList =
      exactMatch.length > 0 ? exactMatch : matches.slice(0, 100);
    setFiltered(finalList);
    setShowDropdown(finalList.length > 0);
  };

  const handleChange = (val) => {
    onChangeText(val);
    setHighlighted(0);
    runFilter(val);
  };

  const handleSelect = (item) => {
    onSelect(item);
    setShowDropdown(false);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((prev) => (prev + 1 >= filtered.length ? 0 : prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((prev) => (prev - 1 < 0 ? filtered.length - 1 : prev - 1));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleSelect(filtered[highlighted]);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <EditableInput
        compact
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => runFilter(value)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
      />
      {showDropdown && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "#fff",
            border: `1px solid ${C.inputBorder}`,
            borderRadius: 4,
            marginTop: 2,
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
          }}
        >
          {filtered.map((item, index) => (
            <div
              key={item.HSCode + index}
              onMouseDown={() => handleSelect(item)}
              onMouseEnter={() => setHighlighted(index)}
              style={{
                padding: "6px 9px",
                fontSize: 12,
                cursor: "pointer",
                background: index === highlighted ? C.bar : "#fff",
                color: index === highlighted ? "#fff" : C.navy,
              }}
            >
              {item.HSCode} - {item.Description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RemoveBtn({ onClick, title }) {
  return (
    <button
      type="button"
      title={title || "Remove"}
      onClick={onClick}
      style={{
        border: "none",
        background: "#fdeceb",
        color: C.danger,
        width: 26,
        height: 26,
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      ×
    </button>
  );
}

function AddBtn({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1.5px dashed ${C.bar}`,
        background: "transparent",
        color: C.bar,
        fontWeight: 700,
        fontSize: 12,
        padding: "6px 12px",
        borderRadius: 6,
        cursor: "pointer",
        marginTop: 6,
      }}
    >
      {label}
    </button>
  );
}

const RELATIONSHIP_OPTIONS = ["RELATED", "NOT RELATED"];
const CURRENCY_OPTIONS = ["USD", "SGD", "INR", "EUR", "GBP", "JPY", "CNY"];

function blankParty() {
  return { code: "", uen: "", name: "", name1: "" };
}

function blankValueRow() {
  return { charges: "", currency: "", exRate: "", amount: "", amountSgd: "" };
}

function blankInvoice() {
  return {
    supplier: blankParty(),
    importer: blankParty(),
    serialNumber: "",
    invoiceDate: "",
    invoiceNumber: "",
    termType: "",
    supplierImporterRelationship: "",
    preferentialDutyRateIndicator: false,
    invoiceValue: blankValueRow(),
    otherValue: blankValueRow(),
    freightValue: { includeInCif: false, ...blankValueRow() },
    insuranceValue: { includeInCif: false, ...blankValueRow() },
    costInsuranceFreight: { amountSgd: "" },
    gst: { charges: "", amountSgd: "" },
  };
}

function InvoiceField({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          color: C.sub,
          fontWeight: 700,
          fontSize: 10.5,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function InvoiceSelect({ value, onChange, options }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: `1px solid ${C.inputBorder}`,
        borderRadius: 4,
        padding: "6px 8px",
        fontSize: 12.5,
        color: C.navy,
        background: C.inputBg,
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "inherit",
      }}
    >
      <option value="">Select</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// Header-tab select: fetches its option list live from `spec.endpoint`
// (cached), always keeps the current value selectable even if it hasn't
// loaded from the backend yet or isn't in the master list (mirrors how
// Header.jsx does `{decType && !declarantType.find(...) && <option .../>}`).
function HeaderSelectField({ spec, value, onChange }) {
  const fetchedOptions = useMasterOptions(spec.endpoint);
  const options =
    fetchedOptions.length > 0
      ? fetchedOptions
      : spec.default
        ? [spec.default]
        : [];

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: `1px solid ${C.inputBorder}`,
        borderRadius: 4,
        padding: "6px 8px",
        fontSize: 12.5,
        color: C.navy,
        background: C.inputBg,
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "inherit",
      }}
    >
      <option value="">--Select--</option>
      {value && !options.includes(value) && (
        <option value={value}>{value}</option>
      )}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function InvoicePartyGroup({ title, party, path, onEdit, extraButton }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: C.navy,
            fontWeight: 800,
            fontSize: 11.5,
            letterSpacing: 0.3,
          }}
        >
          {title}
        </span>
        {extraButton}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        <InvoiceField label="Code">
          <EditableInput
            compact
            value={party.code}
            onChange={(v) => onEdit([...path, "code"], v)}
          />
        </InvoiceField>
        <InvoiceField label="UEN">
          <EditableInput
            compact
            value={party.uen}
            onChange={(v) => onEdit([...path, "uen"], v)}
          />
        </InvoiceField>
        <InvoiceField label="Name">
          <EditableInput
            compact
            value={party.name}
            onChange={(v) => onEdit([...path, "name"], v)}
          />
        </InvoiceField>
        <InvoiceField label="Name 1">
          <EditableInput
            compact
            value={party.name1}
            onChange={(v) => onEdit([...path, "name1"], v)}
          />
        </InvoiceField>
      </div>
    </div>
  );
}

function InvoiceValueRow({ label, row, path, onEdit, hasCheckbox, rowBg }) {
  return (
    <tr style={{ background: rowBg }}>
      <td
        style={{
          padding: "7px 9px",
          borderBottom: `1px solid ${C.panelBorder}`,
          fontSize: 12,
          color: C.navy,
        }}
      >
        {hasCheckbox && (
          <input
            type="checkbox"
            checked={!!row.includeInCif}
            onChange={(e) =>
              onEdit([...path, "includeInCif"], e.target.checked)
            }
            style={{ marginRight: 6, verticalAlign: -2, accentColor: C.bar }}
          />
        )}
        {label}
      </td>
      <td style={{ padding: 6, borderBottom: `1px solid ${C.panelBorder}` }}>
        <EditableInput
          compact
          value={row.charges}
          onChange={(v) => onEdit([...path, "charges"], v)}
          placeholder="0.00"
        />
      </td>
      <td style={{ padding: 6, borderBottom: `1px solid ${C.panelBorder}` }}>
        <InvoiceSelect
          value={row.currency}
          onChange={(v) => onEdit([...path, "currency"], v)}
          options={CURRENCY_OPTIONS}
        />
      </td>
      <td style={{ padding: 6, borderBottom: `1px solid ${C.panelBorder}` }}>
        <EditableInput
          compact
          value={row.exRate}
          onChange={(v) => onEdit([...path, "exRate"], v)}
          placeholder="0.00"
        />
      </td>
      <td style={{ padding: 6, borderBottom: `1px solid ${C.panelBorder}` }}>
        <EditableInput
          compact
          value={row.amount}
          onChange={(v) => onEdit([...path, "amount"], v)}
          placeholder="0.00"
        />
      </td>
      <td style={{ padding: 6, borderBottom: `1px solid ${C.panelBorder}` }}>
        <EditableInput
          compact
          value={row.amountSgd}
          onChange={(v) => onEdit([...path, "amountSgd"], v)}
          placeholder="0.00"
        />
      </td>
    </tr>
  );
}

// Supplier/Manufacturer + Importer party groups, pulled out of Invoice so
// they can render on the Party tab alongside Shipper/Receiver.
function InvoicePartiesBlock({ data, onEdit }) {
  const invoice = { ...blankInvoice(), ...(data.invoice || {}) };
  const path = ["invoice"];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 8,
        padding: 14,
        marginBottom: 18,
        background: "#fafcfd",
      }}
    >
      <InvoicePartyGroup
        title="Supplier / Manufacturer"
        party={invoice.supplier}
        path={[...path, "supplier"]}
        onEdit={onEdit}
      />

      <InvoicePartyGroup
        title="Importer"
        party={invoice.importer}
        path={[...path, "importer"]}
        onEdit={onEdit}
        extraButton={
          <button
            type="button"
            onClick={() => onEdit([...path, "importer"], invoice.supplier)}
            style={{
              border: "none",
              background: C.bar,
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "5px 10px",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            Copy Importer
          </button>
        }
      />
    </div>
  );
}

// Invoice info + value table only — Supplier/Importer now live on the
// Party tab via InvoicePartiesBlock above.
function InvoiceDetailsBlock({ data, onEdit }) {
  const invoice = { ...blankInvoice(), ...(data.invoice || {}) };
  const path = ["invoice"];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 8,
        padding: 14,
        marginBottom: 18,
        background: "#fafcfd",
      }}
    >
      <div
        style={{
          background: C.bar,
          color: C.barText,
          fontWeight: 800,
          fontSize: 11.5,
          letterSpacing: 0.4,
          textAlign: "center",
          padding: "7px 0",
          borderRadius: 4,
          marginBottom: 14,
        }}
      >
        INVOICE INFORMATION
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <InvoiceField label="Serial Number">
          <EditableInput
            compact
            value={invoice.serialNumber}
            onChange={(v) => onEdit([...path, "serialNumber"], v)}
          />
        </InvoiceField>

        <InvoiceField label="Invoice Date">
          <input
            type="date"
            value={invoice.invoiceDate || ""}
            onChange={(e) => onEdit([...path, "invoiceDate"], e.target.value)}
            style={{
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 4,
              padding: "6px 8px",
              fontSize: 12.5,
              color: C.navy,
              width: "100%",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </InvoiceField>

        <InvoiceField label="Invoice Number">
          <EditableInput
            compact
            value={invoice.invoiceNumber}
            onChange={(v) => onEdit([...path, "invoiceNumber"], v)}
          />
        </InvoiceField>

        <InvoiceField label="Term Type">
          <EditableInput
            compact
            value={invoice.termType}
            onChange={(v) => onEdit([...path, "termType"], v)}
          />
        </InvoiceField>

        <InvoiceField label="Supplier Importer Relationship">
          <InvoiceSelect
            value={invoice.supplierImporterRelationship}
            onChange={(v) =>
              onEdit([...path, "supplierImporterRelationship"], v)
            }
            options={RELATIONSHIP_OPTIONS}
          />
        </InvoiceField>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingTop: 18,
          }}
        >
          <input
            type="checkbox"
            checked={!!invoice.preferentialDutyRateIndicator}
            onChange={(e) =>
              onEdit(
                [...path, "preferentialDutyRateIndicator"],
                e.target.checked,
              )
            }
            style={{ width: 16, height: 16, accentColor: C.bar }}
          />
          <span style={{ fontSize: 12, color: C.navy }}>
            Preferential Duty Rate Indicator
          </span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr>
              {[
                "Item",
                "Charges (%)",
                "Currency",
                "Ex.Rate",
                "Amount",
                "Amount ($)",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    background: C.tableHead,
                    color: "#fff",
                    padding: "8px 9px",
                    textAlign: "left",
                    fontSize: 10.5,
                    letterSpacing: 0.3,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <InvoiceValueRow
              label="Invoice Value"
              row={invoice.invoiceValue}
              path={[...path, "invoiceValue"]}
              onEdit={onEdit}
              rowBg={C.rowAlt}
            />
            <InvoiceValueRow
              label="Other Value"
              row={invoice.otherValue}
              path={[...path, "otherValue"]}
              onEdit={onEdit}
              rowBg="#fff"
            />
            <InvoiceValueRow
              label="Freight Value (Incl. Other Value)"
              row={invoice.freightValue}
              path={[...path, "freightValue"]}
              onEdit={onEdit}
              hasCheckbox
              rowBg={C.rowAlt}
            />
            <InvoiceValueRow
              label="Insurance Value (Incl. Freight Value)"
              row={invoice.insuranceValue}
              path={[...path, "insuranceValue"]}
              onEdit={onEdit}
              hasCheckbox
              rowBg="#fff"
            />
            <tr style={{ background: C.rowAlt }}>
              <td
                style={{
                  padding: "7px 9px",
                  borderBottom: `1px solid ${C.panelBorder}`,
                  fontSize: 12,
                  color: C.navy,
                }}
              >
                Cost, Insurance &amp; Freight
              </td>
              <td
                colSpan={4}
                style={{ borderBottom: `1px solid ${C.panelBorder}` }}
              />
              <td
                style={{
                  padding: 6,
                  borderBottom: `1px solid ${C.panelBorder}`,
                }}
              >
                <EditableInput
                  compact
                  value={invoice.costInsuranceFreight.amountSgd}
                  onChange={(v) =>
                    onEdit([...path, "costInsuranceFreight", "amountSgd"], v)
                  }
                  placeholder="0.00"
                />
              </td>
            </tr>
            <tr>
              <td style={{ padding: "7px 9px", fontSize: 12, color: C.navy }}>
                GST
              </td>
              <td style={{ padding: 6 }}>
                <EditableInput
                  compact
                  value={invoice.gst.charges}
                  onChange={(v) => onEdit([...path, "gst", "charges"], v)}
                  placeholder="0.00"
                />
              </td>
              <td colSpan={2} />
              <td />
              <td style={{ padding: 6 }}>
                <EditableInput
                  compact
                  value={invoice.gst.amountSgd}
                  onChange={(v) => onEdit([...path, "gst", "amountSgd"], v)}
                  placeholder="0.00"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableValue({ value, path, onEdit }) {
  const fieldKey = path[path.length - 1];

  if (isItemsField(fieldKey)) {
    const rows =
      Array.isArray(value) && value.length > 0 && isPlainObject(value[0])
        ? value
        : [blankItemRow()];

    const getCell = (row, spec) => {
      const existingKey = findRowKey(row, spec.aliases);
      return existingKey ? row[existingKey] : "";
    };

    const updateCell = (rowIdx, spec, v) => {
      const row = rows[rowIdx] || {};
      const existingKey = findRowKey(row, spec.aliases) || spec.key;
      onEdit([...path, rowIdx, existingKey], v);
    };

    const selectHsCode = (rowIdx, hsItem) => {
      const row = rows[rowIdx] || {};
      const codeSpec = ITEM_FIELD_SPECS.find((s) => s.key === "code");
      const descSpec = ITEM_FIELD_SPECS.find((s) => s.key === "description");
      const codeKey = findRowKey(row, codeSpec.aliases) || codeSpec.key;
      const descKey = findRowKey(row, descSpec.aliases) || descSpec.key;
      onEdit([...path, rowIdx, codeKey], hsItem.HSCode || "");
      onEdit([...path, rowIdx, descKey], hsItem.Description || "");
    };

    const removeRow = (rowIdx) => {
      const next = rows.slice();
      next.splice(rowIdx, 1);
      onEdit(path, next);
    };

    const addRow = () => onEdit(path, [...rows, blankItemRow()]);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 8,
              padding: 12,
              background: i % 2 ? C.rowAlt : "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  color: C.navy,
                  fontWeight: 800,
                  fontSize: 11.5,
                  letterSpacing: 0.3,
                }}
              >
                Item {i + 1}
              </span>
              <RemoveBtn onClick={() => removeRow(i)} title="Remove item" />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px 12px",
              }}
            >
              {ITEM_FIELD_SPECS.map((spec) => (
                <div
                  key={spec.key}
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <span
                    style={{
                      color: C.sub,
                      fontWeight: 700,
                      fontSize: 10.5,
                      letterSpacing: 0.3,
                    }}
                  >
                    {spec.label}
                  </span>
                  {spec.key === "code" ? (
                    <HsCodeInput
                      value={truncateHsCodeDisplay(getCell(row, spec))}
                      onChangeText={(v) => updateCell(i, spec, v)}
                      onSelect={(hsItem) => selectHsCode(i, hsItem)}
                    />
                  ) : (
                    <EditableInput
                      compact
                      value={getCell(row, spec)}
                      onChange={(v) => updateCell(i, spec, v)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <AddBtn onClick={addRow} label="+ Add Item" />
      </div>
    );
  }

  if (Array.isArray(value) && value.length > 0 && isPlainObject(value[0])) {
    const columns = Array.from(
      new Set(value.flatMap((row) => Object.keys(row))),
    );
    const updateCell = (rowIdx, col, v) => onEdit([...path, rowIdx, col], v);
    const removeRow = (rowIdx) => {
      const next = value.slice();
      next.splice(rowIdx, 1);
      onEdit(path, next);
    };
    const addRow = () => {
      const blank = Object.fromEntries(columns.map((c) => [c, ""]));
      onEdit(path, [...value, blank]);
    };
    return (
      <div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
            }}
          >
            <thead>
              <tr>
                <th style={{ background: C.tableHead, width: 34 }} />
                {columns.map((col) => (
                  <th
                    key={col}
                    style={{
                      background: C.tableHead,
                      color: "#fff",
                      padding: "8px 10px",
                      textAlign: "left",
                      fontSize: 11,
                      letterSpacing: 0.4,
                    }}
                  >
                    {formatLabel(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {value.map((row, i) => (
                <tr key={i} style={{ background: i % 2 ? C.rowAlt : "#fff" }}>
                  <td
                    style={{
                      padding: 6,
                      borderBottom: `1px solid ${C.panelBorder}`,
                      textAlign: "center",
                    }}
                  >
                    <RemoveBtn
                      onClick={() => removeRow(i)}
                      title="Remove row"
                    />
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col}
                      style={{
                        padding: 6,
                        borderBottom: `1px solid ${C.panelBorder}`,
                      }}
                    >
                      <EditableInput
                        compact
                        value={row[col]}
                        onChange={(v) => updateCell(i, col, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddBtn onClick={addRow} label="+ Add row" />
      </div>
    );
  }

  if (Array.isArray(value)) {
    const updateItem = (i, v) => {
      const next = value.slice();
      next[i] = v;
      onEdit(path, next);
    };
    const removeItem = (i) => {
      const next = value.slice();
      next.splice(i, 1);
      onEdit(path, next);
    };
    const addItem = () => onEdit(path, [...value, ""]);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {value.map((item, i) => (
          <div
            key={i}
            style={{ display: "flex", gap: 6, alignItems: "center" }}
          >
            <EditableInput
              compact
              value={item}
              onChange={(v) => updateItem(i, v)}
            />
            <RemoveBtn onClick={() => removeItem(i)} />
          </div>
        ))}
        <AddBtn onClick={addItem} label="+ Add" />
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: "#fafcfd",
          border: `1px solid ${C.panelBorder}`,
          borderRadius: 6,
          padding: 12,
        }}
      >
        {renderGroupedEntries(entries, path, onEdit, {
          labelStyle: { color: C.sub, fontWeight: 700, fontSize: 11.5 },
          renderComplex: (k, v) => (
            <div key={k} className="decl-field-row">
              <span
                className="decl-field-label"
                style={{ color: C.sub, fontWeight: 700, fontSize: 11.5 }}
              >
                {formatLabel(k)}
              </span>
              <span className="decl-field-value">
                <EditableValue value={v} path={[...path, k]} onEdit={onEdit} />
              </span>
            </div>
          ),
        })}
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onEdit(path, e.target.checked)}
        style={{ width: 16, height: 16, accentColor: C.bar }}
      />
    );
  }

  return (
    <EditableInput value={value ?? ""} onChange={(v) => onEdit(path, v)} />
  );
}

function deepUpperCase(value) {
  if (typeof value === "string") return value.toUpperCase();
  if (Array.isArray(value)) return value.map(deepUpperCase);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, deepUpperCase(v)]),
    );
  }
  return value;
}

// Same as deepUpperCase, but skips uppercasing for the given TOP-LEVEL keys
// (matched via normalizeKey, so casing/underscore differences don't
// matter). Needed for the Header select fields (DeclarationType,
// CargoPackType, InwardTransportMode, BgIndicator) — their values must
// keep the exact casing returned by the master-data endpoints
// (e.g. "GST : GST (Including Duty Exemption)") or they won't match any
// <option> in the dropdown.
function deepUpperCaseTopLevelExcept(obj, skipKeysNormalized) {
  if (!isPlainObject(obj)) return deepUpperCase(obj);
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = skipKeysNormalized.has(normalizeKey(k)) ? v : deepUpperCase(v);
  }
  return result;
}

// n8n webhooks commonly wrap the actual payload — as an array of items
// ([{ json: {...} }]), nested under a key like json/output/data/result/body,
// or as a JSON *string* (sometimes wrapped in ```json ... ``` fences) when
// the value comes straight out of an AI/LLM node. Unwrap all of that so the
// panel always ends up with a flat field object, regardless of exactly how
// the workflow returns it.
const WRAPPER_KEYS = ["json", "output", "data", "result", "body", "response"];

function tryParseJsonString(str) {
  if (typeof str !== "string") return str;
  let s = str.trim();
  const fenceMatch = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) s = fenceMatch[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    return str; // not valid JSON — leave untouched
  }
}

function normalizeDeclaration(raw) {
  let val = raw;
  let depth = 0;
  while (depth < 6) {
    if (typeof val === "string") {
      const parsed = tryParseJsonString(val);
      if (parsed !== val) {
        val = parsed;
        depth++;
        continue;
      }
      break; // plain non-JSON string — nothing more to unwrap
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return null;
      val = val[0];
      depth++;
      continue;
    }
    if (isPlainObject(val)) {
      const keys = Object.keys(val);
      if (keys.length === 1 && WRAPPER_KEYS.includes(keys[0].toLowerCase())) {
        val = val[keys[0]];
        depth++;
        continue;
      }
    }
    break;
  }
  // If after unwrapping we still don't have a usable object, treat it as
  // "no data yet" rather than silently rendering an empty field list.
  return isPlainObject(val) ? val : null;
}

// ---------------------------------------------------------------------------
// Multi-declaration support
//
// n8n sometimes returns MORE THAN ONE declaration in a single response —
// e.g. one email contains two commercial invoices, each with its own
// fileIndex/consignmentNo (see screenshot: fileIndex 1 -> consignmentNo
// "320262341", fileIndex 2 -> consignmentNo "320262343"). The old
// normalizeDeclaration() above always collapsed any array down to its
// first element, so the second (and any further) declaration was silently
// dropped.
//
// normalizeDeclarations() below always returns an ARRAY of raw declaration
// objects:
//   - the ordinary case (n8n's usual single-item wrapper array, or a plain
//     object) -> an array with exactly ONE entry, so all existing
//     single-declaration behaviour is unchanged.
//   - a genuine multi-invoice email -> an array with one entry PER
//     declaration, in the order n8n returned them.
// ---------------------------------------------------------------------------

// Same string/wrapper-object unwrapping as normalizeDeclaration, but stops
// (and returns as-is) as soon as it hits an array, so the caller can decide
// whether that array is a single-item n8n wrapper or a real multi-
// declaration list.
function unwrapToObjectOrArray(raw) {
  let val = raw;
  let depth = 0;
  while (depth < 6) {
    if (typeof val === "string") {
      const parsed = tryParseJsonString(val);
      if (parsed !== val) {
        val = parsed;
        depth++;
        continue;
      }
      break;
    }
    if (isPlainObject(val)) {
      const keys = Object.keys(val);
      if (keys.length === 1 && WRAPPER_KEYS.includes(keys[0].toLowerCase())) {
        val = val[keys[0]];
        depth++;
        continue;
      }
    }
    break; // arrays fall through untouched — caller inspects them
  }
  return val;
}

// Heuristic: an array counts as "multiple real declarations" (rather than
// n8n's usual single-item wrapper array) when it has more than one entry
// and every entry is a plain object carrying its own fileIndex or
// consignmentNo.
function looksLikeMultipleDeclarations(arr) {
  return (
    Array.isArray(arr) &&
    arr.length > 1 &&
    arr.every(
      (v) =>
        isPlainObject(v) &&
        (findRowKey(v, ["fileindex"]) || findRowKey(v, ["consignmentno"])),
    )
  );
}

// Always returns an array of raw declaration objects (never a bare object,
// never null on its own — a totally empty/unusable payload comes back as
// [null] so downstream code can still fall back to blankDeclaration()).
function normalizeDeclarations(raw) {
  const unwrapped = unwrapToObjectOrArray(raw);

  if (Array.isArray(unwrapped)) {
    if (unwrapped.length === 0) return [null];

    if (looksLikeMultipleDeclarations(unwrapped)) {
      return unwrapped.map((item) => {
        const inner = unwrapToObjectOrArray(item);
        if (isPlainObject(inner)) return inner;
        // in case an individual entry is itself a further-wrapped array
        return normalizeDeclaration(inner);
      });
    }

    // Not a genuine multi-declaration array — this is n8n's ordinary
    // single-item wrapper (e.g. [{ json: {...} }]). Fall back to the
    // original single-declaration unwrapping logic for full compatibility.
    return [normalizeDeclaration(unwrapped)];
  }

  return [isPlainObject(unwrapped) ? unwrapped : null];
}

// Default/blank declaration shape — the simple field set that should always
// appear in the panel, whether or not the LLM has returned data yet.
// Once wired up, LLM extraction output should be merged into this same
// shape. `invoice` and `items` are included here (rather than only
// appearing once real data arrives) so the Invoice and Items tabs are
// never empty.
function blankDeclaration() {
  return {
    FileIndex: "",
    InvoiceIndex: "",
    Format: "",
    ConsignmentNo: "",
    Shipper: {
      Name: "",
      ContactNumber: "",
    },
    Receiver: {
      Name: "",
      Country: "",
      ContactNumber: "",
    },
    NoOfParcels: "",
    TotalWeight: "",

    MessageType: "",
    // Defaults to the common case; only overridden when n8n's extraction
    // explicitly returns a different Declaration Type for this email.
    DeclarationType: "GST : GST (Including Duty Exemption)",
    PreviousPermitNo: "",
    CargoPackType: "",
    InwardTransportMode: "",
    BgIndicator: "",
    OverrideExgeRate: false,
    SupplyIndicator: false,
    ReferenceDocument: false,
    MailboxId: "",
    DeclarantName: "",
    DeclarantCode: "",
    DeclarantTelephone: "",
    CrUeiNo: "",

    invoice: blankInvoice(),
    items: [],
  };
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = [
  { id: "header", label: "Header" },
  { id: "party", label: "Party" },
  { id: "cargo", label: "Cargo" },
  { id: "invoice", label: "Invoice" },
  { id: "items", label: "Items" },
  { id: "summary", label: "Summary" },
];

function TabBar({ active, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              border: `1.5px solid ${isActive ? C.danger : "transparent"}`,
              background: isActive ? C.dangerBg : C.tabIdleBg,
              color: isActive ? C.danger : C.sub,
              fontWeight: 800,
              fontSize: 11.5,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              padding: "9px 18px",
              borderRadius: 20,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// Declaration-page switcher — only rendered when a single email actually
// produced more than one declaration (e.g. two commercial invoices under
// one email). Each button flips DeclarationPanel over to that
// declaration's own Header/Party/Cargo/Invoice/Items/Summary set.
function DeclarationPageBar({ dataList, activeIndex, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        margin: "4px 0 16px",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <span
        style={{
          color: C.sub,
          fontWeight: 700,
          fontSize: 10.5,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          marginRight: 2,
        }}
      >
        {dataList.length} declarations found:
      </span>
      {dataList.map((d, i) => {
        const isActive = i === activeIndex;
        const fileIndex = d?.FileIndex || d?.fileIndex || i + 1;
        const consignmentNo = d?.ConsignmentNo || d?.consignmentNo || "";
        const label = consignmentNo
          ? `File ${fileIndex} · ${consignmentNo}`
          : `Declaration ${i + 1}`;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            style={{
              border: `1.5px solid ${isActive ? C.bar : C.panelBorder}`,
              background: isActive ? C.bar : "#fff",
              color: isActive ? "#fff" : C.navy,
              fontWeight: 700,
              fontSize: 11.5,
              padding: "6px 14px",
              borderRadius: 16,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Header tab: fixed set of fields matching the real declaration form.
// These always render (fall back to spec.default if n8n hasn't returned a
// value at all) and are matched to n8n's data via aliases so key-naming
// differences (case/underscore/spacing) don't hide a field. Select fields
// (Declaration Type, Cargo Pack Type, Inward Transport Mode, BG Indicator)
// pull their live option list from the backend via HeaderSelectField.
function HeaderTabContent({ data, onEdit }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "10px 14px",
      }}
    >
      {HEADER_FIELD_SPECS.map((spec) => {
        const existingKey = findRowKey(data, spec.aliases);
        const rawValue = existingKey ? data[existingKey] : undefined;
        const hasRealValue =
          rawValue !== undefined && rawValue !== null && rawValue !== "";
        const value = hasRealValue
          ? rawValue
          : (spec.default ?? (spec.type === "checkbox" ? false : ""));
        const writeKey = existingKey || spec.key;

        return (
          <div key={spec.key} className="decl-field-row">
            <span
              className="decl-field-label"
              style={{
                display: "block",
                marginBottom: 6,
                color: C.navy,
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: 0.2,
              }}
            >
              {spec.label}
            </span>
            <span className="decl-field-value">
              {spec.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={!!value}
                  onChange={(e) => onEdit([writeKey], e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: C.bar }}
                />
              ) : spec.type === "select" ? (
                <HeaderSelectField
                  spec={spec}
                  value={value}
                  onChange={(v) => onEdit([writeKey], v)}
                />
              ) : (
                <EditableInput
                  compact
                  value={value}
                  onChange={(v) => onEdit([writeKey], v)}
                />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Party tab: Shipper/Receiver (top-level header fields) plus the Invoice's
// Supplier/Manufacturer and Importer groups — everything about who's
// involved in the shipment, in one place.
function PartyTabContent({ data, onEdit }) {
  const partyEntries = Object.entries(data || {}).filter(([key]) =>
    isPartyField(key),
  );

  return (
    <div>
      <div
        style={{
          background: C.bar,
          color: C.barText,
          fontWeight: 800,
          fontSize: 11.5,
          letterSpacing: 0.4,
          textAlign: "center",
          padding: "7px 0",
          borderRadius: 4,
          marginBottom: 14,
        }}
      >
        SHIPMENT PARTIES
      </div>

      {renderGroupedEntries(partyEntries, [], onEdit, {
        labelStyle: {
          color: C.navy,
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: 0.2,
        },
        renderComplex: (key, value) => (
          <div
            key={key}
            className="decl-field-row"
            style={{ marginBottom: 14 }}
          >
            <span
              className="decl-field-label"
              style={{
                color: C.navy,
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: 0.2,
              }}
            >
              {formatLabel(key)}
            </span>
            <span
              className="decl-field-value"
              style={{ display: "block", marginTop: 6 }}
            >
              <EditableValue value={value} path={[key]} onEdit={onEdit} />
            </span>
          </div>
        ),
      })}

      <div
        style={{
          background: C.bar,
          color: C.barText,
          fontWeight: 800,
          fontSize: 11.5,
          letterSpacing: 0.4,
          textAlign: "center",
          padding: "7px 0",
          borderRadius: 4,
          margin: "20px 0 14px",
        }}
      >
        INVOICE PARTIES
      </div>

      <InvoicePartiesBlock data={data} onEdit={onEdit} />
    </div>
  );
}

// Cargo tab: everything that isn't Header/Party/Invoice/Items — currently
// FileIndex, InvoiceIndex, Format, ConsignmentNo, NoOfParcels, TotalWeight,
// MailboxId, DeclarantName/Code/Telephone, CrUeiNo, etc. Temporary home for
// those fields so nothing from n8n or blankDeclaration() gets lost while
// the real Cargo field layout is being designed.
function CargoTabContent({ data, onEdit }) {
  const entries = Object.entries(data || {}).filter(
    ([key]) =>
      !isItemsField(key) &&
      !isInvoiceField(key) &&
      !isPartyField(key) &&
      !isHeaderField(key),
  );

  return (
    <div>
      <div
        style={{
          background: C.bar,
          color: C.barText,
          fontWeight: 800,
          fontSize: 11.5,
          letterSpacing: 0.4,
          textAlign: "center",
          padding: "7px 0",
          borderRadius: 4,
          marginBottom: 14,
        }}
      >
        CARGO
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            border: `1px dashed ${C.panelBorder}`,
            borderRadius: 8,
            padding: 24,
            textAlign: "center",
            color: C.sub,
            fontSize: 12.5,
            background: "#fafcfd",
          }}
        >
          Cargo fields will be added here.
        </div>
      ) : (
        renderGroupedEntries(entries, [], onEdit, {
          labelStyle: {
            color: C.navy,
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: 0.2,
          },
          renderComplex: (key, value) => (
            <div
              key={key}
              className="decl-field-row"
              style={{ marginBottom: 14 }}
            >
              <span
                className="decl-field-label"
                style={{
                  color: C.navy,
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: 0.2,
                }}
              >
                {formatLabel(key)}
              </span>
              <span
                className="decl-field-value"
                style={{ display: "block", marginTop: 6 }}
              >
                <EditableValue value={value} path={[key]} onEdit={onEdit} />
              </span>
            </div>
          ),
        })
      )}
    </div>
  );
}

function InvoiceTabContent({ data, onEdit }) {
  return (
    <div>
      <InvoiceDetailsBlock data={data} onEdit={onEdit} />
    </div>
  );
}

function ItemsTabContent({ data, onEdit }) {
  const items = Array.isArray(data.items) ? data.items : [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            background: C.bar,
            color: C.barText,
            fontWeight: 800,
            fontSize: 11.5,
            letterSpacing: 0.4,
            padding: "7px 16px",
            borderRadius: 4,
          }}
        >
          ITEMS
        </div>
        <span style={{ color: C.sub, fontWeight: 700, fontSize: 11.5 }}>
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      <EditableValue value={data.items} path={["items"]} onEdit={onEdit} />
    </div>
  );
}

function SummaryField({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span
        style={{
          color: C.sub,
          fontWeight: 700,
          fontSize: 10.5,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </span>
      <span style={{ color: C.navy, fontWeight: 600, fontSize: 13 }}>
        {value === "" || value == null ? "—" : String(value)}
      </span>
    </div>
  );
}

function SummaryCard({ title, children }) {
  return (
    <div
      style={{
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 8,
        padding: 14,
        marginBottom: 16,
        background: "#fafcfd",
      }}
    >
      <span
        style={{
          color: C.navy,
          fontWeight: 800,
          fontSize: 13,
          display: "block",
          marginBottom: 12,
        }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

function SummaryTabContent({ data }) {
  const invoice = { ...blankInvoice(), ...(data.invoice || {}) };
  const items = Array.isArray(data.items) ? data.items : [];
  const codeSpec = ITEM_FIELD_SPECS.find((s) => s.key === "code");
  const descSpec = ITEM_FIELD_SPECS.find((s) => s.key === "description");
  const qtySpec = ITEM_FIELD_SPECS.find((s) => s.key === "quantity");
  const totalSpec = ITEM_FIELD_SPECS.find((s) => s.key === "totalValue");
  const countrySpec = ITEM_FIELD_SPECS.find((s) => s.key === "country");

  return (
    <div>
      <SummaryCard title="Shipment Overview">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px 16px",
          }}
        >
          <SummaryField label="File Index" value={data.FileIndex} />
          <SummaryField label="Consignment No" value={data.ConsignmentNo} />
          <SummaryField label="Shipper" value={data.Shipper?.Name} />
          <SummaryField label="Receiver" value={data.Receiver?.Name} />
          <SummaryField
            label="Receiver Country"
            value={data.Receiver?.Country}
          />
          <SummaryField label="No Of Parcels" value={data.NoOfParcels} />
          <SummaryField label="Total Weight" value={data.TotalWeight} />
          <SummaryField label="Message Type" value={data.MessageType} />
          <SummaryField label="Declaration Type" value={data.DeclarationType} />
        </div>
      </SummaryCard>

      <SummaryCard title="Invoice Overview">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px 16px",
          }}
        >
          <SummaryField label="Invoice Number" value={invoice.invoiceNumber} />
          <SummaryField label="Invoice Date" value={invoice.invoiceDate} />
          <SummaryField label="Supplier" value={invoice.supplier?.name} />
          <SummaryField label="Importer" value={invoice.importer?.name} />
          <SummaryField
            label="Invoice Value"
            value={
              invoice.invoiceValue?.amount
                ? `${invoice.invoiceValue.amount} ${invoice.invoiceValue.currency || ""}`.trim()
                : ""
            }
          />
          <SummaryField
            label="CIF Amount ($)"
            value={invoice.costInsuranceFreight?.amountSgd}
          />
          <SummaryField label="GST ($)" value={invoice.gst?.amountSgd} />
        </div>
      </SummaryCard>

      <SummaryCard title={`Items (${items.length})`}>
        {items.length === 0 ? (
          <span style={{ color: C.sub, fontSize: 12.5 }}>
            No items added yet.
          </span>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12.5,
              }}
            >
              <thead>
                <tr>
                  {[
                    "HS Code",
                    "Description",
                    "Qty",
                    "Total Value",
                    "Country",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        background: C.tableHead,
                        color: "#fff",
                        padding: "7px 9px",
                        textAlign: "left",
                        fontSize: 10.5,
                        letterSpacing: 0.3,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 ? C.rowAlt : "#fff" }}>
                    <td
                      style={{
                        padding: "6px 9px",
                        borderBottom: `1px solid ${C.panelBorder}`,
                      }}
                    >
                      {truncateHsCodeDisplay(
                        row[findRowKey(row, codeSpec.aliases)],
                      ) || "—"}
                    </td>
                    <td
                      style={{
                        padding: "6px 9px",
                        borderBottom: `1px solid ${C.panelBorder}`,
                      }}
                    >
                      {row[findRowKey(row, descSpec.aliases)] || "—"}
                    </td>
                    <td
                      style={{
                        padding: "6px 9px",
                        borderBottom: `1px solid ${C.panelBorder}`,
                      }}
                    >
                      {row[findRowKey(row, qtySpec.aliases)] || "—"}
                    </td>
                    <td
                      style={{
                        padding: "6px 9px",
                        borderBottom: `1px solid ${C.panelBorder}`,
                      }}
                    >
                      {row[findRowKey(row, totalSpec.aliases)] || "—"}
                    </td>
                    <td
                      style={{
                        padding: "6px 9px",
                        borderBottom: `1px solid ${C.panelBorder}`,
                      }}
                    >
                      {row[findRowKey(row, countrySpec.aliases)] || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SummaryCard>

      <SummaryCard title="Declarant">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px 16px",
          }}
        >
          <SummaryField label="Declarant Name" value={data.DeclarantName} />
          <SummaryField label="Declarant Code" value={data.DeclarantCode} />
          <SummaryField
            label="Declarant Telephone"
            value={data.DeclarantTelephone}
          />
          <SummaryField label="CR / UEI No" value={data.CrUeiNo} />
          <SummaryField label="Mailbox Id" value={data.MailboxId} />
        </div>
      </SummaryCard>
    </div>
  );
}

export default function DeclarationPanel({ email, declaration, onSave, busy }) {
  // Builds ONE ready-to-render declaration object out of a raw declaration
  // (already unwrapped down to a single plain object, or null).
  const buildData = (raw) =>
    deepUpperCaseTopLevelExcept(
      raw ?? blankDeclaration(),
      HEADER_SELECT_KEYS,
    );

  // Builds the full LIST of ready-to-render declarations for whatever n8n
  // returned for this email. Normal case -> array of length 1. Multi-
  // invoice email -> array of length N, one per declaration.
  const buildAll = (raw) => {
    const rawList = normalizeDeclarations(raw);
    return rawList.map((r) => buildData(r ?? blankDeclaration()));
  };

  const [dataList, setDataList] = useState(() => buildAll(declaration));
  const [pageIndex, setPageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("header");

  useEffect(() => {
    setDataList(buildAll(declaration));
    setPageIndex(0);
    setActiveTab("header");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [declaration, email?.id]);

  const data = dataList[pageIndex] || blankDeclaration();
  const hasMultiple = dataList.length > 1;
  const canSave = !!email && !busy && !!data;

  const handleEdit = (path, value) => {
    // Header select fields (DeclarationType, CargoPackType,
    // InwardTransportMode, BgIndicator) must keep their exact casing so
    // they keep matching the <option> from the master-data endpoint.
    const skipUpperCase =
      path.length === 1 && HEADER_SELECT_KEYS.has(normalizeKey(path[0]));
    setDataList((prev) =>
      prev.map((d, i) =>
        i === pageIndex
          ? setDeep(d, path, skipUpperCase ? value : deepUpperCase(value))
          : d,
      ),
    );
  };

  // Saves just the declaration currently being viewed. When there are
  // multiple declarations for this email, the page index is passed along
  // so the caller can persist each one separately (e.g. keyed by
  // FileIndex/ConsignmentNo on the backend).
  const handleSaveCurrent = () => {
    if (hasMultiple) {
      onSave(data, pageIndex);
    } else {
      onSave(data);
    }
  };

  // Saves every declaration found for this email in one go.
  const handleSaveAll = () => {
    dataList.forEach((d, i) => onSave(d, i));
  };

  return (
    <aside className="declaration-panel">
      <div className="decl-toolbar">
        <button className="decl-button decl-button-amber">Draft</button>
        <button className="decl-button decl-button-red">Query</button>
        <button
          className="decl-button decl-button-verdigris"
          disabled={!canSave}
          onClick={handleSaveCurrent}
        >
          {busy ? "Saving…" : hasMultiple ? "Save Page" : "Save"}
        </button>
        {hasMultiple && (
          <button
            className="decl-button decl-button-verdigris"
            disabled={!canSave}
            onClick={handleSaveAll}
            title="Save every declaration found in this email"
          >
            {busy ? "Saving…" : "Save All"}
          </button>
        )}
      </div>

      <div className="decl-scroll">
        <div className="decl-header">
          <div>
            <h2>{email?.subject || "Untitled declaration"}</h2>
            <div className="decl-sub">{email?.sender || ""}</div>
          </div>
          {email && <StatusStamp status={email.status} />}
        </div>

        {hasMultiple && (
          <DeclarationPageBar
            dataList={dataList}
            activeIndex={pageIndex}
            onChange={setPageIndex}
          />
        )}

        <div className="decl-body">
          <TabBar active={activeTab} onChange={setActiveTab} />

          {activeTab === "header" && (
            <HeaderTabContent data={data} onEdit={handleEdit} />
          )}
          {activeTab === "party" && (
            <PartyTabContent data={data} onEdit={handleEdit} />
          )}
          {activeTab === "cargo" && (
            <CargoTabContent data={data} onEdit={handleEdit} />
          )}
          {activeTab === "invoice" && (
            <InvoiceTabContent data={data} onEdit={handleEdit} />
          )}
          {activeTab === "items" && (
            <ItemsTabContent data={data} onEdit={handleEdit} />
          )}
          {activeTab === "summary" && <SummaryTabContent data={data} />}

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
              Raw response
            </summary>
            <pre
              style={{
                fontSize: 12,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "rgba(0,0,0,0.03)",
                padding: 12,
                borderRadius: 6,
                marginTop: 8,
              }}
            >
              {JSON.stringify(
                hasMultiple ? { declarations: dataList, pageIndex } : data,
                null,
                2,
              )}
            </pre>
          </details>

          <div className="decl-body-save">
            <button
              className="decl-button decl-button-verdigris"
              disabled={!canSave}
              onClick={handleSaveCurrent}
            >
              {busy ? "Saving…" : hasMultiple ? "Save Page" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}