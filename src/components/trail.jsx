import { useState, useEffect, useRef } from "react";
import { FaSearch, FaPlus } from "react-icons/fa";
import StatusStamp from "./StatusStamp";
import API from "../api/api";
import ItemsTabContent from "./itemTab";
import InvoiceTabContent from "./invoiceTab";

export const C = {
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

export const DEFAULT_TOUCH_USER = "LNXADMIN";

function toApiDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isPlainObject(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function formatLabel(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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

function normalizeKey(k) {
  return String(k)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function findRowKey(row, aliases) {
  const keys = Object.keys(row || {});
  return keys.find((k) => aliases.includes(normalizeKey(k)));
}

function getNestedCI(obj, outerAliases, innerAliases) {
  const outerKey = findRowKey(obj, outerAliases);
  const inner = outerKey ? obj[outerKey] : null;
  if (!isPlainObject(inner)) return "";
  const innerKey = findRowKey(inner, innerAliases);
  return innerKey ? inner[innerKey] : "";
}

const PARTY_TOP_LEVEL_FIELDS = ["shipper", "receiver"];
const PARTY_TOP_LEVEL_FIELD_KEYS = PARTY_TOP_LEVEL_FIELDS.map(normalizeKey);

const PARTY_TYPES = {
  importer: {
    dataKey: "Importer",
    label: "Importer",
    commonEndpoint: "/getCommonImporterTableInfo/",
    inpaymentEndpoint: "inpayment/getInImporterTableInfo/",
    saveEndpoint: "/postImporterTable/",
  },
  inwardCarrierAgent: {
    dataKey: "InwardCarrierAgent",
    label: "Inward Carrier Agent",
    commonEndpoint: "/getCommonInwardCarrierAgentTableInfo/",
    inpaymentEndpoint: "inpayment/getInInwardCarrierAgentTableInfo/",
    saveEndpoint: "/postInwardCarrierAgentTable/",
    defaultCode: "SATS LTD",
  },
  freightForwarder: {
    dataKey: "FreightForwarder",
    label: "Freight Forwarder",
    commonEndpoint: "/getCommonFreightForwarderTable/",
    inpaymentEndpoint: "inpayment/getInFreightForwarderTable/",
    saveEndpoint: "/postFreightForwarderTable/",
    defaultCode: "LINEHAUL EXPRESS",
  },
  claimantParty: {
    dataKey: "ClaimantParty",
    label: "Claimant Party",
    commonEndpoint: "/getCommonClaimantPartyTable/",
    inpaymentEndpoint: "inpayment/getInClaimantPartyTable/",
    saveEndpoint: "/postClaimantPartyTable/",
    hasClaimantNameFields: true,
  },
};

const MASTER_PARTY_DATA_KEYS = Object.values(PARTY_TYPES).map(
  (cfg) => cfg.dataKey,
);

function blankMasterParty(cfg) {
  return {
    Code: cfg.defaultCode || "",
    CRUEI: "",
    Name: "",
    Name1: "",
    ...(cfg.hasClaimantNameFields
      ? { ClaimantName: "", ClaimantName1: "" }
      : {}),
  };
}

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
        const list = Array.from(
          new Set(
            (response.data || []).map((item) => item?.Name).filter(Boolean),
          ),
        );
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
// Location suggestions (Release Location / Receipt Location / Loading Port)
// ---------------------------------------------------------------------------

const locationOptionsCache = {};

function useLocationOptions(endpoint) {
  const [options, setOptions] = useState(
    () => locationOptionsCache[endpoint] || [],
  );

  useEffect(() => {
    if (!endpoint) return;
    if (locationOptionsCache[endpoint]) {
      setOptions(locationOptionsCache[endpoint]);
      return;
    }
    let cancelled = false;
    API.get(endpoint)
      .then((response) => {
        const list = response.data || [];
        locationOptionsCache[endpoint] = list;
        if (!cancelled) setOptions(list);
      })
      .catch((error) => {
        console.error(
          `Error fetching location options from ${endpoint}`,
          error,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return options;
}

function LocationSuggestField({
  label,
  endpoint,
  codeKey,
  nameKey,
  extraKey,
  code,
  name,
  onCodeChange,
  onNameChange,
  defaultCode,
}) {
  const options = useLocationOptions(endpoint);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!defaultCode) return;
    if (!options.length) return;
    if (code) return;
    const match = options.find(
      (item) =>
        String(item[codeKey] || "").toLowerCase() === defaultCode.toLowerCase(),
    );
    if (match) {
      onCodeChange(match[codeKey] || defaultCode);
      onNameChange(match[nameKey] || "");
    }
  }, [options, defaultCode]);

  const runFilter = (val) => {
    const search = String(val || "").toLowerCase();
    const matches = !search
      ? options
      : options.filter((item) => {
          const c = String(item[codeKey] || "").toLowerCase();
          const n = String(item[nameKey] || "").toLowerCase();
          return c.startsWith(search) || n.includes(search);
        });
    setFiltered(matches.slice(0, 100));
    setShowDropdown(matches.length > 0);
  };

  const applyItem = (item) => {
    onCodeChange(item[codeKey] || "");
    onNameChange(item[nameKey] || "");
  };

  const handleCodeChange = (val) => {
    onCodeChange(val);
    setHighlighted(0);
    runFilter(val);
  };

  const handleSelect = (item) => {
    applyItem(item);
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

  const handleBlur = () => {
    setTimeout(() => {
      if (!code) {
        setShowDropdown(false);
        return;
      }
      const match = options.find(
        (item) =>
          String(item[codeKey] || "").toLowerCase() === code.toLowerCase(),
      );
      if (match) applyItem(match);
      setShowDropdown(false);
    }, 150);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        marginBottom: 6,
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 62,
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.2,
          color: "#2A3D4F",
          whiteSpace: "normal",
          wordBreak: "normal",
          overflowWrap: "break-word",
          paddingTop: 4,
        }}
      >
        {label}
      </span>
      <FaSearch
        style={{
          color: "#1e6e5c",
          fontSize: 11,
          flexShrink: 0,
          marginTop: 5,
          cursor: "pointer",
        }}
        title={`Browse ${label}`}
        onClick={() => {
          inputRef.current?.focus();
          runFilter(code);
        }}
      />
      <div style={{ flex: "0 0 92px", minWidth: 0, position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={code ?? ""}
          onChange={(e) => handleCodeChange(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onFocus={() => runFilter(code)}
          onBlur={handleBlur}
          placeholder="CODE"
          style={{
            width: "100%",
            minWidth: 0,
            padding: "4px 6px",
            border: "1px solid #C3C1B5",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: 11.5,
            color: "#12202E",
            background: "#fff",
            boxSizing: "border-box",
          }}
        />
        {showDropdown && filtered.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              minWidth: 260,
              zIndex: 30,
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
                key={`${item[codeKey]}-${index}`}
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
                {item[codeKey]} - {item[nameKey]}
                {extraKey && item[extraKey] ? ` (${item[extraKey]})` : ""}
              </div>
            ))}
          </div>
        )}
      </div>
      <input
        type="text"
        value={name ?? ""}
        onChange={(e) => onNameChange(e.target.value.toUpperCase())}
        placeholder="NAME"
        style={{
          flex: 1,
          minWidth: 0,
          padding: "4px 6px",
          border: "1px solid #C3C1B5",
          borderRadius: 4,
          fontFamily: "monospace",
          fontSize: 11.5,
          color: "#12202E",
          background: "#fff",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

const partySuggestionsCache = {};

function usePartySuggestions(type) {
  const cfg = PARTY_TYPES[type];
  const [state, setState] = useState(
    () => partySuggestionsCache[type] || { list: [], commonCodes: new Set() },
  );

  useEffect(() => {
    if (partySuggestionsCache[type]) {
      setState(partySuggestionsCache[type]);
      return;
    }
    let cancelled = false;
    const codeKey = cfg.hasClaimantNameFields ? "ClaimantCode" : "Code";

    (async () => {
      const [commonResult, inpaymentResult] = await Promise.allSettled([
        API.get(cfg.commonEndpoint),
        API.get(cfg.inpaymentEndpoint),
      ]);

      const commonData =
        commonResult.status === "fulfilled"
          ? commonResult.value.data || []
          : [];
      const inpaymentData =
        inpaymentResult.status === "fulfilled"
          ? inpaymentResult.value.data || []
          : [];

      if (commonResult.status === "rejected") {
        console.error(
          `Failed to fetch Common ${cfg.label}`,
          commonResult.reason,
        );
      }
      if (inpaymentResult.status === "rejected") {
        console.error(
          `Failed to fetch Inpayment ${cfg.label}`,
          inpaymentResult.reason,
        );
      }

      const commonCodes = new Set(
        commonData.map((i) => String(i[codeKey] || "").toLowerCase()),
      );

      const merged = [...commonData];
      for (const item of inpaymentData) {
        const code = String(item[codeKey] || "").toLowerCase();
        if (!commonCodes.has(code)) {
          merged.push(item);
        }
      }

      const result = { list: merged, commonCodes };
      partySuggestionsCache[type] = result;
      if (!cancelled) setState(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [type]);

  return state;
}

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

const HEADER_SELECT_KEYS = new Set(
  HEADER_FIELD_SPECS.filter((s) => s.type === "select").flatMap((s) => [
    normalizeKey(s.key),
    ...s.aliases.map(normalizeKey),
  ]),
);

function blankItemRow() {
  return Object.fromEntries(ITEM_FIELD_SPECS.map((s) => [s.key, ""]));
}

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

export function EditableInput({
  value,
  onChange,
  placeholder,
  compact,
  onKeyDown,
  onFocus,
  onBlur,
  disabled,
}) {
  return (
    <input
      type="text"
      value={value ?? ""}
      placeholder={placeholder ?? ""}
      onChange={(e) => onChange && onChange(e.target.value.toUpperCase())}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      readOnly={disabled}
      style={{
        border: `1px solid ${C.inputBorder}`,
        borderRadius: 4,
        padding: compact ? "5px 7px" : "7px 9px",
        fontSize: compact ? 11.5 : 13,
        color: disabled ? C.sub : C.navy,
        background: disabled ? C.tabIdleBg : C.inputBg,
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "inherit",
        cursor: disabled ? "default" : "text",
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

  const handleBlur = () => {
    setTimeout(() => {
      if (!value) {
        setShowDropdown(false);
        return;
      }
      const match = suggestions.find(
        (i) =>
          String(i.HSCode || "").toLowerCase() === String(value).toLowerCase(),
      );
      if (match) {
        onSelect(match);
      }
      setShowDropdown(false);
    }, 150);
  };

  return (
    <div style={{ position: "relative" }}>
      <EditableInput
        compact
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => runFilter(value)}
        onBlur={handleBlur}
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

function PartySearchDropdown({
  items,
  highlighted,
  onSelect,
  onHover,
  getLabel,
}) {
  return (
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
      {items.map((item, index) => (
        <div
          key={index}
          onMouseDown={() => onSelect(item)}
          onMouseEnter={() => onHover(index)}
          style={{
            padding: "6px 9px",
            fontSize: 12,
            cursor: "pointer",
            background: index === highlighted ? C.bar : "#fff",
            color: index === highlighted ? "#fff" : C.navy,
          }}
        >
          {getLabel(item)}
        </div>
      ))}
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
      x
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

// ---------------------------------------------------------------------------
// Invoice tab — Term Type & Currency (mirrors legacy Invoice.jsx behaviour)
// ---------------------------------------------------------------------------

const termTypeCache = { list: null };

function useTermTypeOptions() {
  const [options, setOptions] = useState(() => termTypeCache.list || []);

  useEffect(() => {
    if (termTypeCache.list) {
      setOptions(termTypeCache.list);
      return;
    }
    let cancelled = false;
    API.get("/getTermTypeFromCommonMaster/")
      .then((response) => {
        const raw = response.data || [];
        const seen = new Set();
        const list = raw.filter((t) => {
          if (!t?.Name || seen.has(t.Name)) return false;
          seen.add(t.Name);
          return true;
        });
        termTypeCache.list = list;
        if (!cancelled) setOptions(list);
      })
      .catch((error) => {
        console.error("Error fetching term types", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}

const currencyCache = { list: null };

function useCurrencyOptions() {
  const [options, setOptions] = useState(() => currencyCache.list || []);

  useEffect(() => {
    if (currencyCache.list) {
      setOptions(currencyCache.list);
      return;
    }
    let cancelled = false;
    API.get("/getCommonCurrencyTableInfo/")
      .then((response) => {
        const list = response.data || [];
        currencyCache.list = list;
        if (!cancelled) setOptions(list);
      })
      .catch((error) => {
        console.error("Error fetching currency list", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return options; // [{ Currency: "USD", CurrencyRate: 1.275 }, ...]
}

const TERM_TYPE_VISIBILITY = {
  "CFR : Cost and Frieght ( also known as C & F )": {
    showFreight: false,
    showInsurance: true,
    presetInsurance: true,
  },
  "CIF : Cost,Insurance and Frieght": {
    showFreight: false,
    showInsurance: false,
  },
  "CNI : Cost and Insurance (also Known as C & I )": {
    showFreight: true,
    showInsurance: false,
  },
  "EXW : Exw Works (also known as Ex-Factory)": {
    showFreight: true,
    showInsurance: true,
    presetInsurance: true,
  },
  "FAS : Free Alongside Ship": {
    showFreight: true,
    showInsurance: true,
    presetInsurance: true,
  },
  "FOB : Free On Board": {
    showFreight: true,
    showInsurance: true,
    presetInsurance: true,
  },
};

function getTermTypeVisibility(termType) {
  return (
    TERM_TYPE_VISIBILITY[termType] || { showFreight: true, showInsurance: true }
  );
}

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
    termType: "CIF : Cost,Insurance and Frieght",
    supplierImporterRelationship: "",
    preferentialDutyRateIndicator: false,
    invoiceValue: blankValueRow(),
    otherValue: blankValueRow(),
    freightValue: { includeInCif: false, ...blankValueRow() },
    insuranceValue: { includeInCif: false, ...blankValueRow() },
    costInsuranceFreight: { amountSgd: "" },
    gst: { charges: "9", amountSgd: "" },
  };
}

function InvoiceDateField({ value, onChange }) {
  const [error, setError] = useState(false);

  const getTodayDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleBlur = () => {
    if (!value || value.trim() === "") {
      setError(false);
      return;
    }
    const raw = value.replace(/\D/g, "");

    if (raw.length === 8) {
      const dd = raw.slice(0, 2);
      const mm = raw.slice(2, 4);
      const yyyy = raw.slice(4, 8);
      if (
        parseInt(dd, 10) >= 1 &&
        parseInt(dd, 10) <= 31 &&
        parseInt(mm, 10) >= 1 &&
        parseInt(mm, 10) <= 12
      ) {
        onChange(`${dd}/${mm}/${yyyy}`);
        setError(false);
      } else {
        onChange(getTodayDate());
        setError(true);
      }
    } else if (value.length === 10 && value.includes("/")) {
      setError(false);
    } else {
      onChange(getTodayDate());
      setError(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === " " || e.keyCode === 32) {
      e.preventDefault();
      onChange(getTodayDate());
    }
  };

  return (
    <div>
      <input
        type="text"
        value={value ?? ""}
        placeholder="DD/MM/YYYY"
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{
          border: `1px solid ${error ? C.danger : C.inputBorder}`,
          borderRadius: 4,
          padding: "6px 8px",
          fontSize: 12.5,
          color: C.navy,
          background: C.inputBg,
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
      />
      {error && (
        <span
          style={{
            color: C.danger,
            fontSize: 10,
            fontWeight: 700,
            display: "block",
            marginTop: 2,
          }}
        >
          Invalid date — reset to today
        </span>
      )}
    </div>
  );
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

function InvoiceValueRow({
  label,
  row,
  path,
  onEdit,
  hasCheckbox,
  rowBg,
  currencyOptions,
  onCurrencyChange,
  chargesDisabled,
  amountDisabled,
}) {
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
          disabled={chargesDisabled}
        />
      </td>
      <td style={{ padding: 6, borderBottom: `1px solid ${C.panelBorder}` }}>
        <InvoiceSelect
          value={row.currency}
          onChange={(v) =>
            onCurrencyChange
              ? onCurrencyChange(v)
              : onEdit([...path, "currency"], v)
          }
          options={
            currencyOptions && currencyOptions.length
              ? currencyOptions
              : CURRENCY_OPTIONS
          }
        />
      </td>
      <td style={{ padding: 6, borderBottom: `1px solid ${C.panelBorder}` }}>
        <EditableInput compact value={row.exRate} placeholder="0.00" disabled />
      </td>
      <td style={{ padding: 6, borderBottom: `1px solid ${C.panelBorder}` }}>
        <EditableInput
          compact
          value={row.amount}
          onChange={(v) => onEdit([...path, "amount"], v)}
          placeholder="0.00"
          disabled={amountDisabled}
        />
      </td>
      <td style={{ padding: 6, borderBottom: `1px solid ${C.panelBorder}` }}>
        <EditableInput
          compact
          value={row.amountSgd}
          placeholder="0.00"
          disabled
        />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Invoice tab — Supplier / Manufacturer autocomplete
//
// Suggestions are stored as "Code:CRUEI:Name:Name1" strings — the exact same
// shape the legacy Invoice.jsx used for supplierManuFacturerSuggestions — and
// filtering matches on the concatenated string starting with whatever's typed
// into Code, which in practice means matching on Code prefix. Arrow-key
// navigation, blur-to-match, and save-as-new (FaPlus) all mirror
// handleSupplierManuFacturerChange / handleSupplierManuFacturerFocusOut /
// saveSupplierManuFacturer from the legacy Invoice.jsx.
// ---------------------------------------------------------------------------

const supplierSuggestionsCache = { list: null };

function useSupplierSuggestions() {
  const [list, setList] = useState(() => supplierSuggestionsCache.list || []);

  useEffect(() => {
    if (supplierSuggestionsCache.list) {
      setList(supplierSuggestionsCache.list);
      return;
    }
    let cancelled = false;
    API.get("/getCommonSupplierManufacturerPartTableInfo/")
      .then((response) => {
        const data = (response.data || []).map(
          (i) => `${i.Code}:${i.CRUEI}:${i.Name}:${i.Name1}`,
        );
        supplierSuggestionsCache.list = data;
        if (!cancelled) setList(data);
      })
      .catch((error) => {
        console.error(
          "Failed to fetch Supplier/Manufacturer suggestions",
          error,
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return list; // ["CODE:CRUEI:NAME:NAME1", ...]
}

function InvoiceSupplierField({ supplier, onEdit }) {
  const suggestions = useSupplierSuggestions();
  const [showDropdown, setShowDropdown] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const [highlighted, setHighlighted] = useState(0);

  const runFilter = (val) => {
    if (!val) {
      setShowDropdown(false);
      setFiltered([]);
      return;
    }
    const matches = suggestions.filter((i) =>
      i.toLowerCase().startsWith(val.toLowerCase()),
    );
    setFiltered(matches.slice(0, 100));
    setShowDropdown(matches.length > 0);
  };

  const applyItem = (item) => {
    const [code, cruei, name, name1] = item.split(":");
    onEdit(["invoice", "supplier", "code"], code || "");
    onEdit(["invoice", "supplier", "uen"], cruei || "");
    onEdit(["invoice", "supplier", "name"], name || "");
    onEdit(["invoice", "supplier", "name1"], name1 || "");
  };

  const handleCodeChange = (val) => {
    onEdit(["invoice", "supplier", "code"], val);
    setHighlighted(0);
    runFilter(val);
  };

  const handleSelect = (item) => {
    applyItem(item);
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

  // Blur auto-match — same as legacy handleSupplierManuFacturerFocusOut:
  // if the typed code exactly matches a known supplier, snap to its record.
  const handleBlur = () => {
    setTimeout(() => {
      if (!supplier.code) {
        setShowDropdown(false);
        return;
      }
      const match = suggestions
        .map((i) => i.split(":"))
        .find(([code]) => code.toLowerCase() === supplier.code.toLowerCase());
      if (match) {
        const [code, cruei, name, name1] = match;
        onEdit(["invoice", "supplier", "code"], code);
        onEdit(["invoice", "supplier", "uen"], cruei);
        onEdit(["invoice", "supplier", "name"], name);
        onEdit(["invoice", "supplier", "name1"], name1);
      }
      setShowDropdown(false);
    }, 150);
  };

  const handleSave = async () => {
    if (!supplier.code) {
      alert("Code is required!");
      return;
    }
    const duplicate = suggestions.some(
      (i) => i.split(":")[0].toLowerCase() === supplier.code.toLowerCase(),
    );
    if (duplicate) {
      alert("Duplicate code found! Supplier/Manufacturer not saved.");
      return;
    }
    const payload = {
      Id: 0,
      Code: supplier.code || "",
      CRUEI: supplier.uen || "",
      Name: supplier.name || "",
      Name1: supplier.name1 || "",
      TouchUser: DEFAULT_TOUCH_USER,
      TouchTime: new Date().toISOString(),
      Status: "Active",
    };
    try {
      const response = await API.post(
        "/postSupplierManufacturerPartTable/",
        payload,
      );
      alert(
        response.data?.message || "Supplier/Manufacturer saved successfully!",
      );
      supplierSuggestionsCache.list = [
        ...suggestions,
        `${payload.Code}:${payload.CRUEI}:${payload.Name}:${payload.Name1}`,
      ];
    } catch (err) {
      console.error(
        "Failed to save Supplier/Manufacturer:",
        err.response?.data || err,
      );
      alert(
        err.response?.data?.error ||
          "Failed to save Supplier/Manufacturer, check console for details",
      );
    }
  };

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
          Supplier / Manufacturer
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FaSearch
            style={{ color: C.bar, fontSize: 12, cursor: "pointer" }}
            title="Search Supplier / Manufacturer"
            onClick={() => runFilter(supplier.code)}
          />
          <FaPlus
            style={{ cursor: "pointer", color: C.bar, fontSize: 12 }}
            onClick={handleSave}
            title="Save as new Supplier / Manufacturer"
          />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        <InvoiceField label="Code">
          <div style={{ position: "relative" }}>
            <EditableInput
              compact
              value={supplier.code}
              onChange={handleCodeChange}
              onKeyDown={handleKeyDown}
              onFocus={() => runFilter(supplier.code)}
              onBlur={handleBlur}
            />
            {showDropdown && filtered.length > 0 && (
              <PartySearchDropdown
                items={filtered}
                highlighted={highlighted}
                onHover={setHighlighted}
                onSelect={handleSelect}
                getLabel={(item) => {
                  const [code, , name] = item.split(":");
                  return `${code} - ${name || ""}`;
                }}
              />
            )}
          </div>
        </InvoiceField>
        <InvoiceField label="UEN">
          <EditableInput
            compact
            value={supplier.uen}
            onChange={(v) => onEdit(["invoice", "supplier", "uen"], v)}
          />
        </InvoiceField>
        <InvoiceField label="Name">
          <EditableInput
            compact
            value={supplier.name}
            onChange={(v) => onEdit(["invoice", "supplier", "name"], v)}
          />
        </InvoiceField>
        <InvoiceField label="Name 1">
          <EditableInput
            compact
            value={supplier.name1}
            onChange={(v) => onEdit(["invoice", "supplier", "name1"], v)}
          />
        </InvoiceField>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InvoicePartiesBlock — Supplier (editable, with suggestions above) +
// Importer (read-only display of data.Importer — the Party tab is the only
// place that edits it, so the two tabs never disagree).
// ---------------------------------------------------------------------------

function InvoicePartiesBlock({ data, onEdit }) {
  const invoice = { ...blankInvoice(), ...(data.invoice || {}) };
  const importer = data.Importer || {
    Code: "",
    CRUEI: "",
    Name: "",
    Name1: "",
  };

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
      <InvoiceSupplierField supplier={invoice.supplier} onEdit={onEdit} />

      {/* IMPORTER — read-only, mirrors data.Importer from the Party tab */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginBottom: 16,
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
          Importer
        </span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          <InvoiceField label="Code">
            <EditableInput compact value={importer.Code} disabled />
          </InvoiceField>
          <InvoiceField label="CRUEI">
            <EditableInput compact value={importer.CRUEI} disabled />
          </InvoiceField>
          <InvoiceField label="Name">
            <EditableInput compact value={importer.Name} disabled />
          </InvoiceField>
          <InvoiceField label="Name 1">
            <EditableInput compact value={importer.Name1} disabled />
          </InvoiceField>
        </div>
      </div>
    </div>
  );
}

const TOTAL_VALUE_GBP_ALIASES = ["totalvaluegbp", "totalvalue"];

function InvoiceDetailsBlock({ data, onEdit }) {
  const invoice = {
    ...blankInvoice(),
    ...(data.invoice || {}),
    gst: {
      charges:
        data.invoice?.gst?.charges && data.invoice.gst.charges !== "0"
          ? data.invoice.gst.charges
          : "9",
      amountSgd: data.invoice?.gst?.amountSgd || "",
    },
  };
  const path = ["invoice"];

  const termTypeOptions = useTermTypeOptions();
  const currencyOptions = useCurrencyOptions();
  const currencyNames = currencyOptions.map((c) => c.Currency).filter(Boolean);

  const visibility = getTermTypeVisibility(invoice.termType);
  const showFreight = visibility.showFreight;
  const showInsurance = visibility.showInsurance;

  const findCurrencyRate = (name) => {
    const match = currencyOptions.find((c) => c.Currency === name);
    return match ? String(match.CurrencyRate) : "";
  };

  const handleCurrencyChange = (rowPath, name) => {
    onEdit([...rowPath, "currency"], name);
    onEdit([...rowPath, "exRate"], findCurrencyRate(name));
  };

  // ── Prefill Invoice Value's Amount only, from the top-level totalValueGBP
  //    field in the incoming declaration payload. Currency and Ex.Rate are
  //    left untouched — those still come from the user picking a currency
  //    (handleCurrencyChange) or from term-type presets, same as before.
  //    Only fills when Amount is still empty, so it never overwrites a
  //    value the user or a saved record already has.
  const totalValueGBPKey = findRowKey(data, TOTAL_VALUE_GBP_ALIASES);
  const totalValueGBP = totalValueGBPKey ? data[totalValueGBPKey] : "";

  useEffect(() => {
    if (totalValueGBP === "" || totalValueGBP == null) return;
    if (invoice.invoiceValue.amount) return; // don't overwrite an existing value

    onEdit([...path, "invoiceValue", "amount"], String(totalValueGBP));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalValueGBP]);

  // Term Type drives which rows show and resets the calculation table —
  // mirrors handleTermChange() in the legacy Invoice.jsx.
  const handleTermTypeChange = (newTermType) => {
    const rule = getTermTypeVisibility(newTermType);
    const nextInvoice = {
      ...invoice,
      termType: newTermType,
      invoiceValue: blankValueRow(),
      otherValue: blankValueRow(),
      freightValue: { includeInCif: false, ...blankValueRow() },
      insuranceValue: {
        includeInCif: false,
        ...blankValueRow(),
        ...(rule.presetInsurance
          ? { charges: "1.00", currency: "SGD", exRate: "1.000000" }
          : {}),
      },
      costInsuranceFreight: { amountSgd: "" },
      gst: { charges: "9", amountSgd: "" },
    };
    onEdit(path, nextInvoice);
  };

  // ── CALCULATIONS — mirrors the totals useEffect in legacy Invoice.jsx ──
  useEffect(() => {
    const invAmount = parseFloat(invoice.invoiceValue.amount) || 0;
    const invEx = parseFloat(invoice.invoiceValue.exRate) || 0;
    const invDollar = invAmount * invEx;

    const othAmount = parseFloat(invoice.otherValue.amount) || 0;
    const othEx = parseFloat(invoice.otherValue.exRate) || 0;
    const othDollar = othAmount * othEx;

    let frAmount = 0;
    let frDollar = 0;
    if (showFreight) {
      const frCharge = parseFloat(invoice.freightValue.charges) || 0;
      const frEx = parseFloat(invoice.freightValue.exRate) || 0;
      frAmount = parseFloat(invoice.freightValue.amount) || 0;

      if (frCharge > 0 && frEx > 0) {
        const calculated = (invDollar * frCharge) / 100 / frEx;
        if (invoice.freightValue.amount !== calculated.toFixed(2)) {
          onEdit([...path, "freightValue", "amount"], calculated.toFixed(2));
        }
        frAmount = calculated;
      }
      frDollar = frAmount * frEx;
    }

    let insAmount = 0;
    let insDollar = 0;
    if (showInsurance) {
      const charge = parseFloat(invoice.insuranceValue.charges) || 0;
      const insEx = parseFloat(invoice.insuranceValue.exRate) || 0;

      if (charge > 0) {
        const base = showFreight ? invDollar + frDollar : invDollar;
        const calculated = (base * charge) / 100;
        if (invoice.insuranceValue.amount !== calculated.toFixed(2)) {
          onEdit([...path, "insuranceValue", "amount"], calculated.toFixed(2));
        }
        insAmount = calculated;
      } else {
        insAmount = parseFloat(invoice.insuranceValue.amount) || 0;
      }
      insDollar = insAmount * insEx;
    }

    const nextInvDollar = invDollar.toFixed(2);
    const nextOthDollar = othDollar.toFixed(2);
    const nextFrDollar = frDollar.toFixed(2);
    const nextInsDollar = insDollar.toFixed(2);

    if (invoice.invoiceValue.amountSgd !== nextInvDollar) {
      onEdit([...path, "invoiceValue", "amountSgd"], nextInvDollar);
    }
    if (invoice.otherValue.amountSgd !== nextOthDollar) {
      onEdit([...path, "otherValue", "amountSgd"], nextOthDollar);
    }
    if (invoice.freightValue.amountSgd !== nextFrDollar) {
      onEdit([...path, "freightValue", "amountSgd"], nextFrDollar);
    }
    if (invoice.insuranceValue.amountSgd !== nextInsDollar) {
      onEdit([...path, "insuranceValue", "amountSgd"], nextInsDollar);
    }

    const cif = invDollar + othDollar + frDollar + insDollar;
    const cifFixed = cif.toFixed(2);
    if (invoice.costInsuranceFreight.amountSgd !== cifFixed) {
      onEdit([...path, "costInsuranceFreight", "amountSgd"], cifFixed);
    }

    const gstPercent = parseFloat(invoice.gst.charges) || 0;
    const gstFixed = (cif * (gstPercent / 100)).toFixed(2);
    if (invoice.gst.amountSgd !== gstFixed) {
      onEdit([...path, "gst", "amountSgd"], gstFixed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    invoice.invoiceValue.amount,
    invoice.invoiceValue.exRate,
    invoice.otherValue.amount,
    invoice.otherValue.exRate,
    invoice.freightValue.amount,
    invoice.freightValue.charges,
    invoice.freightValue.exRate,
    invoice.insuranceValue.amount,
    invoice.insuranceValue.charges,
    invoice.insuranceValue.exRate,
    invoice.gst.charges,
    showFreight,
    showInsurance,
  ]);

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
          <InvoiceDateField
            value={invoice.invoiceDate}
            onChange={(v) => onEdit([...path, "invoiceDate"], v)}
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
          <InvoiceSelect
            value={invoice.termType}
            onChange={handleTermTypeChange}
            options={termTypeOptions.map((t) => t.Name).filter(Boolean)}
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
              currencyOptions={currencyNames}
              onCurrencyChange={(name) =>
                handleCurrencyChange([...path, "invoiceValue"], name)
              }
            />
            <InvoiceValueRow
              label="Other Value"
              row={invoice.otherValue}
              path={[...path, "otherValue"]}
              onEdit={onEdit}
              rowBg="#fff"
              currencyOptions={currencyNames}
              onCurrencyChange={(name) =>
                handleCurrencyChange([...path, "otherValue"], name)
              }
            />
            {showFreight && (
              <InvoiceValueRow
                label="Freight Value (Incl. Other Value)"
                row={invoice.freightValue}
                path={[...path, "freightValue"]}
                onEdit={onEdit}
                hasCheckbox
                rowBg={C.rowAlt}
                currencyOptions={currencyNames}
                onCurrencyChange={(name) =>
                  handleCurrencyChange([...path, "freightValue"], name)
                }
                amountDisabled={parseFloat(invoice.freightValue.charges) > 0}
              />
            )}
            {showInsurance && (
              <InvoiceValueRow
                label="Insurance Value (Incl. Freight Value)"
                row={invoice.insuranceValue}
                path={[...path, "insuranceValue"]}
                onEdit={onEdit}
                hasCheckbox
                rowBg="#fff"
                currencyOptions={currencyNames}
                onCurrencyChange={(name) =>
                  handleCurrencyChange([...path, "insuranceValue"], name)
                }
                amountDisabled={parseFloat(invoice.insuranceValue.charges) > 0}
              />
            )}
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
                  placeholder="0.00"
                  disabled
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
                  placeholder="0.00"
                  disabled
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PartyFieldRow({ children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function PartyFieldCell({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        position: "relative",
      }}
    >
      {label && (
        <span
          style={{
            color: C.sub,
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: 0.3,
          }}
        >
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

function MasterPartyField({ type, data, onEdit }) {
  const cfg = PARTY_TYPES[type];
  const { list, commonCodes } = usePartySuggestions(type);
  const path = [cfg.dataKey];
  const party = data[cfg.dataKey] || blankMasterParty(cfg);
  const codeKey = cfg.hasClaimantNameFields ? "ClaimantCode" : "Code";
  const codeInputRef = useRef(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const [highlighted, setHighlighted] = useState(0);

  useEffect(() => {
    if (!cfg.defaultCode) return;
    if (!list.length) return;
    if (party.Name) return;
    if ((party.Code || "").toLowerCase() !== cfg.defaultCode.toLowerCase()) {
      return;
    }

    const normalize = (s) =>
      String(s || "")
        .trim()
        .toLowerCase()
        .replace(/\.$/, "");
    const target = normalize(cfg.defaultCode);

    const match = list.find((i) => normalize(i[codeKey]) === target);

    if (match) {
      onEdit([...path, "Code"], match[codeKey] || cfg.defaultCode);
      onEdit([...path, "CRUEI"], match.CRUEI || "");
      onEdit([...path, "Name"], match.Name || "");
      onEdit([...path, "Name1"], match.Name1 || "");
      if (cfg.hasClaimantNameFields) {
        onEdit([...path, "ClaimantName"], match.ClaimantName || "");
        onEdit([...path, "ClaimantName1"], match.ClaimantName1 || "");
      }
    }
  }, [list]);

  const runFilter = (val) => {
    if (!val) {
      setShowDropdown(false);
      setFiltered([]);
      return;
    }
    const search = val.toLowerCase();
    const matches = list.filter((i) => {
      const code = String(i[codeKey] || "").toLowerCase();
      const name = String(i.Name || "").toLowerCase();
      return code.startsWith(search) || name.startsWith(search);
    });
    setFiltered(matches.slice(0, 100));
    setShowDropdown(matches.length > 0);
  };

  const applyRecord = (rec) => {
    onEdit([...path, "Code"], rec[codeKey] || "");
    onEdit([...path, "CRUEI"], rec.CRUEI || "");
    onEdit([...path, "Name"], rec.Name || "");
    onEdit([...path, "Name1"], rec.Name1 || "");
    if (cfg.hasClaimantNameFields) {
      onEdit([...path, "ClaimantName"], rec.ClaimantName || "");
      onEdit([...path, "ClaimantName1"], rec.ClaimantName1 || "");
    }
  };
  const handleCodeChange = (val) => {
    onEdit([...path, "Code"], val);
    setHighlighted(0);
    runFilter(val);
  };

  const handleSelect = (rec) => {
    applyRecord(rec);
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

  const handleBlur = () => {
    setTimeout(() => {
      if (!party.Code) {
        setShowDropdown(false);
        return;
      }
      const match = list.find(
        (i) =>
          String(i[codeKey] || "").toLowerCase() === party.Code.toLowerCase(),
      );
      if (match) {
        applyRecord(match);
      }
      setShowDropdown(false);
    }, 150);
  };

  const handleSave = async () => {
    if (!party.Code) {
      alert("Code is required!");
      codeInputRef.current?.focus();
      return;
    }
    if (commonCodes.has(party.Code.toLowerCase())) {
      alert(`Duplicate code found! ${cfg.label} not saved.`);
      return;
    }

    const payload = {
      Id: 0,
      [codeKey]: (party.Code || "").toUpperCase(),
      CRUEI: (party.CRUEI || "").toUpperCase(),
      Name: (party.Name || "").toUpperCase(),
      Name1: (party.Name1 || "").toUpperCase(),
      ...(cfg.hasClaimantNameFields
        ? {
            ClaimantName: (party.ClaimantName || "").toUpperCase(),
            ClaimantName1: (party.ClaimantName1 || "").toUpperCase(),
            Name2: "",
          }
        : {}),
      TouchUser: DEFAULT_TOUCH_USER,
      TouchTime: new Date().toISOString(),
      Status: "Active",
    };

    try {
      const response = await API.post(cfg.saveEndpoint, payload);
      alert(
        response.data?.message ||
          response.data?.Result ||
          `${cfg.label} saved successfully!`,
      );
      console.log(`Saved ${cfg.label}:`, response.data);
      commonCodes.add(party.Code.toLowerCase());
    } catch (err) {
      console.error(`Failed to save ${cfg.label}:`, err.response?.data || err);
      alert(
        err.response?.data?.error ||
          err.response?.data?.Result ||
          `Failed to save ${cfg.label}, check console for details`,
      );
    }
  };

  return (
    <div
      style={{
        marginBottom: 14,
        paddingBottom: 12,
        borderBottom: `1px solid ${C.panelBorder}`,
      }}
    >
      {/* LABEL + ICONS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            color: C.navy,
            fontWeight: 700,
            fontSize: 11.5,
            letterSpacing: 0.2,
            textTransform: "uppercase",
          }}
        >
          {cfg.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FaSearch
            style={{ color: C.bar, fontSize: 12, cursor: "pointer" }}
            title={`Search ${cfg.label}`}
            onClick={() => codeInputRef.current?.focus()}
          />
          <FaPlus
            style={{ cursor: "pointer", color: C.bar, fontSize: 12 }}
            onClick={handleSave}
            title={`Save as new ${cfg.label}`}
          />
        </div>
      </div>

      {/* LINE 1: CODE | CRUEI */}
      <PartyFieldRow>
        <PartyFieldCell label="Code">
          <EditableInput
            compact
            value={party.Code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            onFocus={() => runFilter(party.Code)}
            onBlur={handleBlur}
            placeholder="CODE"
          />
          {showDropdown && filtered.length > 0 && (
            <PartySearchDropdown
              items={filtered}
              highlighted={highlighted}
              onHover={setHighlighted}
              onSelect={handleSelect}
              getLabel={(item) => `${item[codeKey]} - ${item.Name || ""}`}
            />
          )}
        </PartyFieldCell>
        <PartyFieldCell label="CRUEI">
          <EditableInput
            compact
            value={party.CRUEI}
            onChange={(v) => onEdit([...path, "CRUEI"], v)}
            placeholder="CRUEI"
          />
        </PartyFieldCell>
      </PartyFieldRow>

      {/* LINE 2: NAME | NAME1 */}
      <PartyFieldRow>
        <PartyFieldCell label="Name">
          <EditableInput
            compact
            value={party.Name}
            onChange={(v) => onEdit([...path, "Name"], v)}
            placeholder="NAME"
          />
        </PartyFieldCell>
        <PartyFieldCell label="Name1">
          <EditableInput
            compact
            value={party.Name1}
            onChange={(v) => onEdit([...path, "Name1"], v)}
            placeholder="NAME1"
          />
        </PartyFieldCell>
      </PartyFieldRow>

      {/* CLAIMANT ID / CLAIMANT NAME — extra line, same two-column pattern */}
      {cfg.hasClaimantNameFields && (
        <PartyFieldRow>
          <PartyFieldCell label="Claimant Id">
            <EditableInput
              compact
              value={party.ClaimantName}
              onChange={(v) => onEdit([...path, "ClaimantName"], v)}
              placeholder="CLAIMANT ID"
            />
          </PartyFieldCell>
          <PartyFieldCell label="Claimant Name">
            <EditableInput
              compact
              value={party.ClaimantName1}
              onChange={(v) => onEdit([...path, "ClaimantName1"], v)}
              placeholder="CLAIMANT NAME"
            />
          </PartyFieldCell>
        </PartyFieldRow>
      )}
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

function deepUpperCaseTopLevelExcept(obj, skipKeysNormalized) {
  if (!isPlainObject(obj)) return deepUpperCase(obj);
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = skipKeysNormalized.has(normalizeKey(k)) ? v : deepUpperCase(v);
  }
  return result;
}

const WRAPPER_KEYS = ["json", "output", "data", "result", "body", "response"];

function tryParseJsonString(str) {
  if (typeof str !== "string") return str;
  let s = str.trim();
  const fenceMatch = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) s = fenceMatch[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    return str;
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
      break;
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

  return isPlainObject(val) ? val : null;
}

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
    break;
  }
  return val;
}

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

function normalizeDeclarations(raw) {
  const unwrapped = unwrapToObjectOrArray(raw);

  if (Array.isArray(unwrapped)) {
    if (unwrapped.length === 0) return [null];

    if (looksLikeMultipleDeclarations(unwrapped)) {
      return unwrapped.map((item) => {
        const inner = unwrapToObjectOrArray(item);
        if (isPlainObject(inner)) return inner;

        return normalizeDeclaration(inner);
      });
    }

    return [normalizeDeclaration(unwrapped)];
  }

  return [isPlainObject(unwrapped) ? unwrapped : null];
}

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

    // Cargo tab fields — mirrors the real InPayment Cargo page.
    // NOTE: "Mode" is intentionally NOT duplicated here — the Cargo tab's
    // Mode field reads straight from InwardTransportMode above (see
    // CargoTabContent), so there is only ever one source of truth.
    TotalOuterPack: "",
    TotalOuterPackUnit: "PKG",
    TotalGrossWeight: "",
    TotalGrossWeightUnit: "KGM",
    PermitGrossWeight: "",
    ReleaseLocation: { Code: "", Name: "" },
    ReceiptLocation: { Code: "", Name: "" },
    LoadingPort: { Code: "", Name: "" },
    Hawb: "",
    ArrivalDate: "",
    FlightNumber: "",
    AircraftRegNo: "",
    Mawb: "",
    BlanketStartDate: "",

    Importer: { Code: "", CRUEI: "", Name: "", Name1: "" },
    InwardCarrierAgent: blankMasterParty(PARTY_TYPES.inwardCarrierAgent),
    FreightForwarder: blankMasterParty(PARTY_TYPES.freightForwarder),
    ClaimantParty: blankMasterParty(PARTY_TYPES.claimantParty),

    // Summary tab
    ApprovedBy: "",
    CustomerRemarks: "",
    TradeRemarks: "",
    FormatRemark: "",
    CrossReference: "",
    InternalRemarks: "",
    DeclarationChecked: false,

    invoice: blankInvoice(),
    invoices: [],
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

function DeclarationPageBar({
  dataList,
  activeIndex,
  onChange,
  pageIdentities,
}) {
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
        const needsNew = !pageIdentities?.[i];
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            title={
              needsNew
                ? "Click New to generate a Permit ID for this declaration"
                : undefined
            }
            style={{
              border: `1.5px solid ${isActive ? C.bar : needsNew ? C.danger : C.panelBorder}`,
              background: isActive ? C.bar : "#fff",
              color: isActive ? "#fff" : needsNew ? C.danger : C.navy,
              fontWeight: 700,
              fontSize: 11.5,
              padding: "6px 14px",
              borderRadius: 16,
              cursor: "pointer",
            }}
          >
            {label}
            {needsNew ? " •" : ""}
          </button>
        );
      })}
    </div>
  );
}

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

function PartyTabContent({ data, onEdit }) {
  const receiverName = getNestedCI(data, ["receiver"], ["name"]);
  const importerRaw = data.Importer;
  const dataForImporter = {
    ...data,
    Importer: importerRaw
      ? {
          Code: importerRaw.Code ?? "",
          CRUEI: importerRaw.CRUEI ?? "",
          Name: importerRaw.Name ?? "",
          Name1: importerRaw.Name1 ?? "",
        }
      : {
          Code: receiverName || "",
          CRUEI: "",
          Name: receiverName || "",
          Name1: "",
        },
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 8,
        padding: 12,
        background: "#fafcfd",
      }}
    >
      <MasterPartyField
        type="importer"
        data={dataForImporter}
        onEdit={onEdit}
      />
      <MasterPartyField type="inwardCarrierAgent" data={data} onEdit={onEdit} />
      <MasterPartyField type="freightForwarder" data={data} onEdit={onEdit} />
      <MasterPartyField type="claimantParty" data={data} onEdit={onEdit} />
    </div>
  );
}

const CARGO_FIELD_SPECS = {
  totalOuterPack: {
    key: "TotalOuterPack",
    label: "Total Outer Pack",
    aliases: ["totalouterpack", "outerpackqty", "outerpackquantity"],
    unitAliases: ["totalouterpackunit", "outerpackunit", "totalouterpackuom"],
    defaultUnit: "PKG",
  },
  totalGrossWeight: {
    key: "TotalGrossWeight",
    label: "Total Gross Weight",
    aliases: ["totalgrossweight", "grossweight"],
    unitAliases: [
      "totalgrossweightunit",
      "grossweightunit",
      "totalgrossweightuom",
    ],
    defaultUnit: "KGM",
  },
  permitGrossWeight: {
    key: "PermitGrossWeight",
    label: "Permit Gross Weight",
    aliases: ["permitgrossweight"],
  },
  releaseLocation: {
    key: "ReleaseLocation",
    label: "Release Location",
    nestedAliases: ["releaselocation"],
    codeAliases: ["releaselocationcode"],
    nameAliases: ["releaselocationname"],
    // Matches the legacy Cargo.jsx behaviour where Release Location comes in
    // pre-filled with CZ / CHANGI FTZ.
    defaultCode: "CZ",
  },
  receiptLocation: {
    key: "ReceiptLocation",
    label: "Receipt Location",
    nestedAliases: ["receiptlocation"],
    codeAliases: ["receiptlocationcode"],
    nameAliases: ["receiptlocationname"],
    defaultCode: "O",
    // TODO: confirm the correct default code for Receipt Location with Ed —
    // set it here (e.g. defaultCode: "OTHERS") once confirmed, the same way
    // releaseLocation.defaultCode is set above.
  },
  loadingPort: {
    key: "LoadingPort",
    label: "Loading Port",
    nestedAliases: ["loadingport"],
    codeAliases: ["loadingportcode"],
    nameAliases: ["loadingportname"],
  },
  hawb: {
    key: "Hawb",
    label: "HAWB",
    aliases: ["hawb"],
  },
  arrivalDate: {
    key: "ArrivalDate",
    label: "Arrival Date",
    aliases: ["arrivaldate"],
  },
  flightNumber: {
    key: "FlightNumber",
    label: "Flight Number",
    aliases: ["flightnumber", "flightno"],
  },
  aircraftRegNo: {
    key: "AircraftRegNo",
    label: "Aircraft Reg No",
    aliases: ["aircraftregno", "aircraftregistrationno"],
  },
  mawb: {
    key: "Mawb",
    label: "MAWB",
    aliases: ["mawb"],
  },
  blanketStartDate: {
    key: "BlanketStartDate",
    label: "Blanket Start Date",
    aliases: ["blanketstartdate"],
  },
};

function cargoGetScalar(data, aliases, covered) {
  const key = findRowKey(data, aliases);
  if (key && covered) covered.add(normalizeKey(key));
  return key ? data[key] : "";
}

function cargoScalarPath(data, aliases, fallbackKey) {
  const key = findRowKey(data, aliases);
  return [key || fallbackKey];
}

// Reads a value+unit pair (Total Outer Pack, Total Gross Weight).
function cargoGetWeightPair(data, spec, covered) {
  const valueKey = findRowKey(data, spec.aliases);
  const unitKey = findRowKey(data, spec.unitAliases);
  if (valueKey && covered) covered.add(normalizeKey(valueKey));
  if (unitKey && covered) covered.add(normalizeKey(unitKey));
  return {
    value: valueKey ? data[valueKey] : "",
    unit: unitKey ? data[unitKey] : spec.defaultUnit,
    valuePath: [valueKey || spec.key],
    unitPath: [unitKey || `${spec.key}Unit`],
  };
}

function cargoGetLocation(data, spec, covered) {
  const nestedKey = findRowKey(data, spec.nestedAliases);
  if (nestedKey && isPlainObject(data[nestedKey])) {
    if (covered) covered.add(normalizeKey(nestedKey));
    const obj = data[nestedKey];
    const codeKey = findRowKey(obj, ["code"]);
    const nameKey = findRowKey(obj, ["name"]);
    return {
      code: codeKey ? obj[codeKey] : "",
      name: nameKey ? obj[nameKey] : "",
      codePath: [nestedKey, codeKey || "Code"],
      namePath: [nestedKey, nameKey || "Name"],
    };
  }

  const flatCodeKey = findRowKey(data, spec.codeAliases);
  const flatNameKey = findRowKey(data, spec.nameAliases);
  if (flatCodeKey || flatNameKey) {
    if (flatCodeKey && covered) covered.add(normalizeKey(flatCodeKey));
    if (flatNameKey && covered) covered.add(normalizeKey(flatNameKey));
    return {
      code: flatCodeKey ? data[flatCodeKey] : "",
      name: flatNameKey ? data[flatNameKey] : "",
      codePath: [flatCodeKey || `${spec.key}Code`],
      namePath: [flatNameKey || `${spec.key}Name`],
    };
  }

  return {
    code: "",
    name: "",
    codePath: [spec.key, "Code"],
    namePath: [spec.key, "Name"],
  };
}

function CargoSectionCard({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #c2d7e8",
        borderRadius: 5,
        padding: 8,
        background: "#fafcfd",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "#0f3c52",
          color: "#eaf3f9",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          textAlign: "center",
          padding: "7px 0",
          borderRadius: 4,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function CargoTextRow({ label, value, onChange, disabled }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        marginBottom: 6,
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 62,
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.2,
          color: "#2A3D4F",
          whiteSpace: "normal",
          wordBreak: "normal",
          overflowWrap: "break-word",
          paddingTop: 4,
        }}
      >
        {label}
      </span>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange && onChange(e.target.value.toUpperCase())}
        disabled={disabled}
        style={{
          flex: 1,
          minWidth: 0,
          padding: "4px 6px",
          border: disabled ? "1px solid #8FA5B5" : "1px solid #C3C1B5",
          borderRadius: 4,
          fontFamily: "monospace",
          fontSize: 11.5,
          fontWeight: disabled ? 700 : 400,
          color: disabled ? "#0b2f3f" : "#12202E",
          background: disabled ? "#e9eef2" : "#fff",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function CargoWeightRow({
  label,
  value,
  unit,
  unitOptions,
  onValueChange,
  onUnitChange,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        marginBottom: 6,
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 62,
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.2,
          color: "#2A3D4F",
          whiteSpace: "normal",
          wordBreak: "normal",
          overflowWrap: "break-word",
          paddingTop: 4,
        }}
      >
        {label}
      </span>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onValueChange(e.target.value)}
        style={{
          flex: "0 0 50px",
          minWidth: 0,
          padding: "4px 6px",
          border: "1px solid #8FA5B5",
          borderRadius: 4,
          fontFamily: "monospace",
          fontSize: 11.5,
          fontWeight: 600,
          color: "#12202E",
          background: "#fff",
          boxSizing: "border-box",
        }}
      />
      <select
        value={unit || ""}
        onChange={(e) => onUnitChange(e.target.value)}
        style={{
          flex: "0 0 58px",
          minWidth: 0,
          padding: "3px 4px",
          border: "1px solid #8FA5B5",
          borderRadius: 4,
          fontFamily: "monospace",
          fontSize: 10.5,
          fontWeight: 600,
          color: "#0b2f3f",
          background: "#fff",
        }}
      >
        <option value="">--Select--</option>
        {unit && unitOptions && !unitOptions.includes(unit) && (
          <option value={unit}>{unit}</option>
        )}
        {(unitOptions || []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// Date field with the same focus-out behavior as the legacy Cargo.jsx
// (useCargoDate in cargoFunctions.js): typing raw digits (e.g. "27082026")
// auto-formats to DD/MM/YYYY on blur; an invalid date reverts to today;
// pressing Space fills in today's date.
function CargoDateField({ label, value, onChange }) {
  const [error, setError] = useState(false);

  const getTodayDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleBlur = () => {
    if (!value || value.trim() === "") {
      setError(false);
      return;
    }
    const raw = value.replace(/\D/g, "");

    if (raw.length === 8) {
      const dd = raw.slice(0, 2);
      const mm = raw.slice(2, 4);
      const yyyy = raw.slice(4, 8);
      if (
        parseInt(dd, 10) >= 1 &&
        parseInt(dd, 10) <= 31 &&
        parseInt(mm, 10) >= 1 &&
        parseInt(mm, 10) <= 12
      ) {
        onChange(`${dd}/${mm}/${yyyy}`);
        setError(false);
      } else {
        onChange(getTodayDate());
        setError(true);
      }
    } else if (value.length === 10 && value.includes("/")) {
      setError(false);
    } else {
      onChange(getTodayDate());
      setError(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === " " || e.keyCode === 32) {
      e.preventDefault();
      onChange(getTodayDate());
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        marginBottom: 6,
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 62,
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.2,
          color: "#2A3D4F",
          whiteSpace: "normal",
          wordBreak: "normal",
          overflowWrap: "break-word",
          paddingTop: 4,
        }}
      >
        {label}
      </span>
      <input
        type="text"
        value={value ?? ""}
        placeholder="DD/MM/YYYY"
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          minWidth: 0,
          padding: "4px 6px",
          border: error ? "1px solid #c0392b" : "1px solid #C3C1B5",
          borderRadius: 4,
          fontFamily: "monospace",
          fontSize: 11.5,
          color: "#12202E",
          background: "#fff",
          boxSizing: "border-box",
        }}
      />
      {error && (
        <span
          style={{
            color: "#c0392b",
            fontSize: 10,
            fontWeight: 700,
            alignSelf: "center",
          }}
        >
          Invalid date — reset to today
        </span>
      )}
    </div>
  );
}

function CargoTabContent({ data, onEdit }) {
  const covered = new Set();

  // Master options — same endpoints as original Cargo.jsx
  const outerPackUnitOptions = useMasterOptions(
    "/getTotalOuterPackFromCommonMaster/",
  );
  const grossWeightUnitOptions = ["KGM", "TNE"];

  const totalOuterPack = cargoGetWeightPair(
    data,
    CARGO_FIELD_SPECS.totalOuterPack,
    covered,
  );

  const totalWeightKey = findRowKey(data, ["totalweight"]);
  const totalWeightFallback = totalWeightKey ? data[totalWeightKey] : "";
  const totalGrossWeightRaw = cargoGetWeightPair(
    data,
    CARGO_FIELD_SPECS.totalGrossWeight,
    covered,
  );
  const totalGrossWeightKeyExists = !!findRowKey(
    data,
    CARGO_FIELD_SPECS.totalGrossWeight.aliases,
  );

  const totalGrossWeight = {
    ...totalGrossWeightRaw,
    value: totalGrossWeightKeyExists
      ? totalGrossWeightRaw.value
      : totalWeightFallback || "",
  };

  const permitGrossWeight = cargoGetScalar(
    data,
    CARGO_FIELD_SPECS.permitGrossWeight.aliases,
    covered,
  );

  const releaseLocation = cargoGetLocation(
    data,
    CARGO_FIELD_SPECS.releaseLocation,
    covered,
  );
  const receiptLocation = cargoGetLocation(
    data,
    CARGO_FIELD_SPECS.receiptLocation,
    covered,
  );

  const consignmentNoKey = findRowKey(data, ["consignmentno"]);
  const consignmentNo = consignmentNoKey ? data[consignmentNoKey] : "";
  const hawbRaw = cargoGetScalar(data, CARGO_FIELD_SPECS.hawb.aliases, covered);

  const hawbKeyExists = !!findRowKey(data, CARGO_FIELD_SPECS.hawb.aliases);
  const hawb = hawbKeyExists ? hawbRaw : consignmentNo || "";

  const headerModeSpec = HEADER_FIELD_SPECS.find(
    (s) => s.key === "InwardTransportMode",
  );
  const headerModeKey =
    findRowKey(data, headerModeSpec.aliases) || headerModeSpec.key;
  const mode = data[headerModeKey] || "";
  covered.add(normalizeKey(headerModeKey));
  // ─────────────────────────────────────────────────────────────────────

  const loadingPort = cargoGetLocation(
    data,
    CARGO_FIELD_SPECS.loadingPort,
    covered,
  );
  // const hawb = cargoGetScalar(data, CARGO_FIELD_SPECS.hawb.aliases, covered);
  const arrivalDate = cargoGetScalar(
    data,
    CARGO_FIELD_SPECS.arrivalDate.aliases,
    covered,
  );
  const flightNumber = cargoGetScalar(
    data,
    CARGO_FIELD_SPECS.flightNumber.aliases,
    covered,
  );
  const aircraftRegNo = cargoGetScalar(
    data,
    CARGO_FIELD_SPECS.aircraftRegNo.aliases,
    covered,
  );
  const mawb = cargoGetScalar(data, CARGO_FIELD_SPECS.mawb.aliases, covered);
  const blanketStartDate = cargoGetScalar(
    data,
    CARGO_FIELD_SPECS.blanketStartDate.aliases,
    covered,
  );

  // ── PERMIT GROSS WEIGHT CALCULATION (mirrors Cargo.jsx useEffect) ──────
  const permitWeightPath = cargoScalarPath(
    data,
    CARGO_FIELD_SPECS.permitGrossWeight.aliases,
    CARGO_FIELD_SPECS.permitGrossWeight.key,
  );

  useEffect(() => {
    const raw = totalGrossWeight.value;
    const uom = totalGrossWeight.unit;
    if (!raw || !uom || uom === "--Select--") {
      onEdit(permitWeightPath, "");
      return;
    }
    const weight = Number(raw);
    if (isNaN(weight)) {
      onEdit(permitWeightPath, "");
      return;
    }
    const computed = uom === "TNE" ? weight / 1000 : weight;
    onEdit(permitWeightPath, String(computed));
  }, [totalGrossWeight.value, totalGrossWeight.unit]);

  const isSeaMode = /sea/i.test(mode || "");
  const seaUnitMismatch =
    isSeaMode && totalGrossWeight.unit && totalGrossWeight.unit !== "TNE";

  // ─────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}
    >
      <div className="cargo-grid-2col">
        <CargoSectionCard title="OUTER PACK DETAILS">
          <CargoWeightRow
            label="Total Outer Pack"
            value={totalOuterPack.value}
            unit={totalOuterPack.unit}
            unitOptions={outerPackUnitOptions}
            onValueChange={(v) => onEdit(totalOuterPack.valuePath, v)}
            onUnitChange={(v) => onEdit(totalOuterPack.unitPath, v)}
          />
          <CargoWeightRow
            label="Total Gross Weight"
            value={totalGrossWeight.value}
            unit={totalGrossWeight.unit}
            unitOptions={grossWeightUnitOptions}
            onValueChange={(v) => onEdit(totalGrossWeight.valuePath, v)}
            onUnitChange={(v) => onEdit(totalGrossWeight.unitPath, v)}
          />
          {seaUnitMismatch && (
            <div
              style={{
                color: "#c0392b",
                fontSize: 10,
                fontWeight: 700,
                marginTop: -2,
                marginBottom: 6,
              }}
            >
              Sea mode requires Gross Weight unit = TNE
            </div>
          )}
          <CargoTextRow
            label="Permit Gross Weight"
            value={permitGrossWeight}
            onChange={(v) => onEdit(permitWeightPath, v)}
          />
        </CargoSectionCard>

        <CargoSectionCard title="LOCATION INFORMATION">
          <LocationSuggestField
            label="Release Location"
            endpoint="/getReleaseLocation/"
            codeKey="Code"
            nameKey="Description"
            extraKey="LocationCode"
            code={releaseLocation.code}
            name={releaseLocation.name}
            onCodeChange={(v) => onEdit(releaseLocation.codePath, v)}
            onNameChange={(v) => onEdit(releaseLocation.namePath, v)}
            defaultCode={CARGO_FIELD_SPECS.releaseLocation.defaultCode}
          />
          <LocationSuggestField
            label="Receipt Location"
            endpoint="/getReceiptLocation/"
            codeKey="Code"
            nameKey="Description"
            extraKey="LocationCode"
            code={receiptLocation.code}
            name={receiptLocation.name}
            onCodeChange={(v) => onEdit(receiptLocation.codePath, v)}
            onNameChange={(v) => onEdit(receiptLocation.namePath, v)}
            defaultCode={CARGO_FIELD_SPECS.receiptLocation.defaultCode}
          />
        </CargoSectionCard>
      </div>

      <CargoSectionCard title="INWARD DETAILS">
        <CargoTextRow
          label="Mode"
          value={mode}
          onChange={(v) => onEdit([headerModeKey], v)}
        />
        <LocationSuggestField
          label="Loading Port"
          endpoint="/getLoadingPort/"
          codeKey="PortCode"
          nameKey="PortName"
          extraKey="Country"
          code={loadingPort.code}
          name={loadingPort.name}
          onCodeChange={(v) => onEdit(loadingPort.codePath, v)}
          onNameChange={(v) => onEdit(loadingPort.namePath, v)}
        />
        <CargoTextRow
          label="HAWB"
          value={hawb}
          onChange={(v) =>
            onEdit(
              cargoScalarPath(
                data,
                CARGO_FIELD_SPECS.hawb.aliases,
                CARGO_FIELD_SPECS.hawb.key,
              ),
              v,
            )
          }
        />
        <CargoDateField
          label="Arrival Date"
          value={arrivalDate}
          onChange={(v) =>
            onEdit(
              cargoScalarPath(
                data,
                CARGO_FIELD_SPECS.arrivalDate.aliases,
                CARGO_FIELD_SPECS.arrivalDate.key,
              ),
              v,
            )
          }
        />
        <CargoTextRow
          label="Flight Number"
          value={flightNumber}
          onChange={(v) =>
            onEdit(
              cargoScalarPath(
                data,
                CARGO_FIELD_SPECS.flightNumber.aliases,
                CARGO_FIELD_SPECS.flightNumber.key,
              ),
              v,
            )
          }
        />
        <CargoTextRow
          label="Aircraft Reg No"
          value={aircraftRegNo}
          onChange={(v) =>
            onEdit(
              cargoScalarPath(
                data,
                CARGO_FIELD_SPECS.aircraftRegNo.aliases,
                CARGO_FIELD_SPECS.aircraftRegNo.key,
              ),
              v,
            )
          }
        />
        <CargoTextRow
          label="MAWB"
          value={mawb}
          onChange={(v) =>
            onEdit(
              cargoScalarPath(
                data,
                CARGO_FIELD_SPECS.mawb.aliases,
                CARGO_FIELD_SPECS.mawb.key,
              ),
              v,
            )
          }
        />
        <CargoDateField
          label="Blanket Start Date"
          value={blanketStartDate}
          onChange={(v) =>
            onEdit(
              cargoScalarPath(
                data,
                CARGO_FIELD_SPECS.blanketStartDate.aliases,
                CARGO_FIELD_SPECS.blanketStartDate.key,
              ),
              v,
            )
          }
        />
      </CargoSectionCard>
      {/* 
      Leftover fields (FileIndex, InvoiceIndex, Format, ConsignmentNo, NoOfParcels,
          TotalWeight, TotalValueGBP) hidden for now — design pass only. */}
      {/* {leftoverEntries.length > 0 &&
        renderGroupedEntries(leftoverEntries, [], onEdit, {
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
        })} */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoice tab — invoice list table (mirrors the legacy Invoice.jsx
// "INVOICE TABLE": S.No, Invoice Number, Invoice Date, Term Type, Currency,
// Amount, CIF/FOB ($), GST ($), with per-row Edit/Delete).
// ---------------------------------------------------------------------------

function InvoiceTableSection({ invoices, onEditRow, onDeleteRow }) {
  const columns = [
    "Delete",
    "Edit",
    "S.No",
    "Invoice Number",
    "Invoice Date",
    "Term Type",
    "Currency",
    "Amount",
    "CIF/FOB ($)",
    "GST ($)",
  ];

  return (
    <div style={{ marginTop: 8 }}>
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
          marginBottom: 10,
        }}
      >
        INVOICE TABLE
      </div>
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
              {columns.map((h) => (
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
            {invoices.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: 14,
                    textAlign: "center",
                    color: C.sub,
                    fontSize: 12.5,
                  }}
                >
                  No invoices added yet.
                </td>
              </tr>
            ) : (
              invoices.map((inv, i) => (
                <tr
                  key={inv.sNo ?? i}
                  style={{ background: i % 2 ? C.rowAlt : "#fff" }}
                >
                  <td
                    style={{
                      padding: 6,
                      borderBottom: `1px solid ${C.panelBorder}`,
                      textAlign: "center",
                    }}
                  >
                    <RemoveBtn
                      onClick={() => onDeleteRow(inv.sNo)}
                      title="Delete invoice"
                    />
                  </td>
                  <td
                    style={{
                      padding: 6,
                      borderBottom: `1px solid ${C.panelBorder}`,
                      textAlign: "center",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onEditRow(inv.sNo)}
                      title="Edit invoice"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: C.bar,
                        cursor: "pointer",
                        fontWeight: 800,
                        fontSize: 14,
                      }}
                    >
                      ✎
                    </button>
                  </td>
                  <td
                    style={{
                      padding: "7px 9px",
                      borderBottom: `1px solid ${C.panelBorder}`,
                      fontSize: 12,
                      color: C.navy,
                    }}
                  >
                    {inv.sNo}
                  </td>
                  <td
                    style={{
                      padding: "7px 9px",
                      borderBottom: `1px solid ${C.panelBorder}`,
                      fontSize: 12,
                      color: C.navy,
                    }}
                  >
                    {inv.invoiceNumber || "—"}
                  </td>
                  <td
                    style={{
                      padding: "7px 9px",
                      borderBottom: `1px solid ${C.panelBorder}`,
                      fontSize: 12,
                      color: C.navy,
                    }}
                  >
                    {inv.invoiceDate || "—"}
                  </td>
                  <td
                    style={{
                      padding: "7px 9px",
                      borderBottom: `1px solid ${C.panelBorder}`,
                      fontSize: 12,
                      color: C.navy,
                    }}
                  >
                    {inv.termType || "—"}
                  </td>
                  <td
                    style={{
                      padding: "7px 9px",
                      borderBottom: `1px solid ${C.panelBorder}`,
                      fontSize: 12,
                      color: C.navy,
                    }}
                  >
                    {inv.invoiceValue?.currency || "—"}
                  </td>
                  <td
                    style={{
                      padding: "7px 9px",
                      borderBottom: `1px solid ${C.panelBorder}`,
                      fontSize: 12,
                      color: C.navy,
                    }}
                  >
                    {inv.invoiceValue?.amount || "—"}
                  </td>
                  <td
                    style={{
                      padding: "7px 9px",
                      borderBottom: `1px solid ${C.panelBorder}`,
                      fontSize: 12,
                      color: C.navy,
                    }}
                  >
                    {inv.costInsuranceFreight?.amountSgd || "—"}
                  </td>
                  <td
                    style={{
                      padding: "7px 9px",
                      borderBottom: `1px solid ${C.panelBorder}`,
                      fontSize: 12,
                      color: C.navy,
                    }}
                  >
                    {inv.gst?.amountSgd || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDateForApi(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month}-${day}`;
}

function buildInvoicePayload(invoice, importer, sNo, permitId) {
  const visibility = getTermTypeVisibility(invoice.termType);
  const showFreight = visibility.showFreight;
  const showInsurance = visibility.showInsurance;

  return {
    PermitId: permitId,
    SNo: sNo,
    InvoiceNo: (invoice.invoiceNumber || "").toUpperCase(),
    InvoiceDate: formatDateForApi(invoice.invoiceDate),
    TermType: invoice.termType || "",
    AdValoremIndicator: "False",
    PreDutyRateIndicator: invoice.preferentialDutyRateIndicator
      ? "True"
      : "False",
    SupplierImporterRelationship:
      invoice.supplierImporterRelationship || "--Select--",
    SupplierCode: invoice.supplier?.code || "-",
    ImportPartyCode: importer?.Code || "",

    TICurrency: invoice.invoiceValue.currency || "",
    TIExRate: Number(invoice.invoiceValue.exRate) || 0,
    TIAmount: Number(invoice.invoiceValue.amount) || 0,
    TISAmount: Number(invoice.invoiceValue.amountSgd) || 0,

    OTCCharge: Number(invoice.otherValue.charges) || 0,
    OTCCurrency: invoice.otherValue.currency || "--Select--",
    OTCExRate: Number(invoice.otherValue.exRate) || 0,
    OTCAmount: Number(invoice.otherValue.amount) || 0,
    OTCSAmount: Number(invoice.otherValue.amountSgd) || 0,

    FCCharge: showFreight ? Number(invoice.freightValue.charges) || 0 : 0,
    FCCurrency: showFreight
      ? invoice.freightValue.currency || "--Select--"
      : "--Select--",
    FCExRate: showFreight ? Number(invoice.freightValue.exRate) || 0 : 0,
    FCAmount: showFreight ? Number(invoice.freightValue.amount) || 0 : 0,
    FCSAmount: showFreight ? Number(invoice.freightValue.amountSgd) || 0 : 0,

    ICCharge: showInsurance ? Number(invoice.insuranceValue.charges) || 0 : 0,
    ICCurrency: showInsurance
      ? invoice.insuranceValue.currency || "--Select--"
      : "--Select--",
    ICExRate: showInsurance ? Number(invoice.insuranceValue.exRate) || 0 : 0,
    ICAmount: showInsurance ? Number(invoice.insuranceValue.amount) || 0 : 0,
    ICSAmount: showInsurance
      ? Number(invoice.insuranceValue.amountSgd) || 0
      : 0,

    CIFSUMAmount: Number(invoice.costInsuranceFreight.amountSgd) || 0,
    GSTPercentage: Number(invoice.gst.charges) || 0,
    GSTSUMAmount: Number(invoice.gst.amountSgd) || 0,
    MessageType: "IPTDEC",
    TouchUser: DEFAULT_TOUCH_USER,
    TouchTime: new Date().toISOString(),
    ChkOtherInv: "No",
  };
}

// function InvoiceTabContent({ data, onEdit, permitId }) {
//   const invoices = Array.isArray(data.invoices) ? data.invoices : [];
//   const [savingInvoice, setSavingInvoice] = useState(false);

//   const handleAddInvoice = async () => {
//     if (!permitId) {
//       alert(
//         'Click "New" first to generate a Permit ID before adding an invoice.',
//       );
//       return;
//     }

//     const current = { ...blankInvoice(), ...(data.invoice || {}) };

//     if (!current.invoiceNumber || !current.invoiceNumber.trim()) {
//       alert("Invoice Number is required!");
//       return;
//     }
//     if (!current.invoiceDate || !current.invoiceDate.trim()) {
//       alert("Invoice Date is required!");
//       return;
//     }

//     const nextSNo =
//       invoices.length > 0
//         ? Math.max(...invoices.map((inv) => Number(inv.sNo) || 0)) + 1
//         : 1;

//     const rowToSave = { ...current, sNo: nextSNo };
//     const payload = buildInvoicePayload(
//       rowToSave,
//       data.Importer,
//       nextSNo,
//       permitId,
//     );

//     setSavingInvoice(true);
//     try {
//       await API.post("/postInvoiceTable/", payload);
//       onEdit(["invoices"], [...invoices, rowToSave]);
//       onEdit(["invoice"], blankInvoice());
//     } catch (err) {
//       console.error("Failed to save invoice:", err.response?.data || err);
//       alert(
//         err.response?.data?.error ||
//           "Failed to save invoice. Please try again.",
//       );
//     } finally {
//       setSavingInvoice(false);
//     }
//   };

//   const handleEditRow = (sNo) => {
//     const row = invoices.find((inv) => inv.sNo === sNo);
//     if (!row) return;
//     onEdit(["invoice"], row);
//     onEdit(
//       ["invoices"],
//       invoices.filter((inv) => inv.sNo !== sNo),
//     );
//   };

//   const handleDeleteRow = (sNo) => {
//     onEdit(
//       ["invoices"],
//       invoices.filter((inv) => inv.sNo !== sNo),
//     );
//   };

//   return (
//     <div>
//       <InvoicePartiesBlock data={data} onEdit={onEdit} />
//       <InvoiceDetailsBlock data={data} onEdit={onEdit} />

//       <div
//         style={{
//           display: "flex",
//           justifyContent: "flex-end",
//           marginBottom: 18,
//         }}
//       >
//         <button
//           type="button"
//           onClick={handleAddInvoice}
//           disabled={savingInvoice}
//           style={{
//             border: `1.5px dashed ${C.bar}`,
//             background: "transparent",
//             color: C.bar,
//             fontWeight: 700,
//             fontSize: 12,
//             padding: "6px 12px",
//             borderRadius: 6,
//             cursor: savingInvoice ? "not-allowed" : "pointer",
//             opacity: savingInvoice ? 0.6 : 1,
//           }}
//         >
//           {savingInvoice ? "Saving…" : "+ Add Invoice"}
//         </button>
//       </div>

//       <InvoiceTableSection
//         invoices={invoices}
//         onEditRow={handleEditRow}
//         onDeleteRow={handleDeleteRow}
//       />
//     </div>
//   );
// }

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

function SummaryInputBox({ label, value, onChange, readOnly, wide }) {
  return (
    <div style={{ gridColumn: wide ? "span 2" : "span 1", minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.navy,
          marginBottom: 3,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </div>
      <input
        type="text"
        value={value ?? ""}
        readOnly={readOnly}
        onChange={(e) => onChange && onChange(e.target.value)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "4px 6px",
          fontSize: 11,
          border: `1px solid ${C.inputBorder}`,
          borderRadius: 3,
          background: readOnly ? "#eef2f5" : "#fff",
          color: C.navy,
        }}
      />
    </div>
  );
}

function money(val) {
  const num = Number(val);
  return isNaN(num) ? "0.00" : num.toFixed(2);
}

function SummaryTabContent({ data, onEdit }) {
  const items = Array.isArray(data.items) ? data.items : [];
  const invoices = Array.isArray(data.invoices) ? data.invoices : [];
  const importer = data.Importer || { Code: "", Name: "" };

  const totalSpec = ITEM_FIELD_SPECS.find((s) => s.key === "totalValue");
  const toNum = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  const sumItemValue = items.reduce(
    (sum, row) => sum + toNum(row[findRowKey(row, totalSpec.aliases)]),
    0,
  );
  const totalInvoiceCif = invoices.reduce(
    (sum, inv) => sum + toNum(inv?.costInsuranceFreight?.amountSgd),
    0,
  );
  const totalItemGst = invoices.reduce(
    (sum, inv) => sum + toNum(inv?.gst?.amountSgd),
    0,
  ); // swap source if item-level GST exists in your data
  const totalGstValue = totalItemGst;
  const totalAmountPayable = totalGstValue;

  // group invoice / item amounts by currency
  const invoiceByCurrency = {};
  invoices.forEach((inv) => {
    const cur = inv?.invoiceValue?.currency || "";
    invoiceByCurrency[cur] =
      (invoiceByCurrency[cur] || 0) + toNum(inv?.invoiceValue?.amount);
  });

  const qtySpec = ITEM_FIELD_SPECS.find((s) => s.key === "quantity");
  const itemByCurrency = {}; // no per-item currency in this schema — using totalValue only
  items.forEach((row) => {
    itemByCurrency["—"] =
      (itemByCurrency["—"] || 0) +
      toNum(row[findRowKey(row, totalSpec.aliases)]);
  });

  const set = (field, value) => onEdit([field], value);

  const showPermitFunction = () => {
    const text = data.PreviousPermitNo?.trim()
      ? `PREVIOUS PERMIT NO : ${data.PreviousPermitNo}`
      : "PREVIOUS PERMIT NO :";
    set(
      "TradeRemarks",
      (data.TradeRemarks || "") + (data.TradeRemarks ? "\n" : "") + text,
    );
  };

  const showExRate = () => {
    const grouped = {};
    invoices.forEach((inv) => {
      const cur = inv?.invoiceValue?.currency || "";
      grouped[cur] = (grouped[cur] || 0) + toNum(inv?.invoiceValue?.exRate);
    });
    const text = Object.keys(grouped)
      .map(
        (cur) =>
          `CURRENCY : ${cur} , EXCHANGE RATE : ${grouped[cur].toFixed(6)}`,
      )
      .join("\n");
    set(
      "TradeRemarks",
      (data.TradeRemarks || "") + (data.TradeRemarks ? "\n" : "") + text,
    );
  };

  const applyFormatRemark = () => {
    set(
      "TradeRemarks",
      (data.TradeRemarks || "").replaceAll("\n", data.FormatRemark || ""),
    );
    set("FormatRemark", "");
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px 10px",
    marginBottom: 10,
  };

  return (
    <div
      style={{
        background: "#e9f1f8",
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div style={gridStyle}>
        <SummaryInputBox
          label="NO OF INVOICES"
          value={invoices.length}
          readOnly
        />
        <SummaryInputBox label="NO OF ITEMS" value={items.length} readOnly />
        <SummaryInputBox
          label="SUM OF ITEM VALUE"
          value={money(sumItemValue)}
          readOnly
        />
        <SummaryInputBox
          label="TOTAL INVOICE CIF VALUE"
          value={money(totalInvoiceCif)}
          readOnly
        />

        <SummaryInputBox
          label="TOTAL CIF/FOB VALUE"
          value={money(totalInvoiceCif)}
          readOnly
        />
        <SummaryInputBox
          label="TOTAL GST VALUE"
          value={money(totalGstValue)}
          readOnly
        />
        <SummaryInputBox label="EXCISE DUTY" value="0.00" readOnly />
        <SummaryInputBox label="CUSTOMS DUTY" value="0.00" readOnly />

        <SummaryInputBox label="OTHER TAX" value="0.00" readOnly />
        <SummaryInputBox
          label="TOTAL AMOUNT PAYABLE"
          value={money(totalAmountPayable)}
          readOnly
        />
        <div>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: C.navy,
              marginBottom: 4,
            }}
          >
            SUM OF INVOICE AMOUNT
          </div>
          {Object.entries(invoiceByCurrency).length === 0 ? (
            <SummaryInputBox value="" readOnly />
          ) : (
            Object.entries(invoiceByCurrency).map(([cur, amt]) => (
              <div
                key={cur}
                style={{ display: "flex", gap: 6, marginBottom: 4 }}
              >
                <input
                  value={cur}
                  readOnly
                  style={{
                    width: 60,
                    border: `1px solid ${C.inputBorder}`,
                    borderRadius: 4,
                    padding: "4px 6px",
                    background: "#eef2f5",
                  }}
                />
                <input
                  value={money(amt)}
                  readOnly
                  style={{
                    flex: 1,
                    border: `1px solid ${C.inputBorder}`,
                    borderRadius: 4,
                    padding: "4px 6px",
                    background: "#eef2f5",
                  }}
                />
              </div>
            ))
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: C.navy,
              marginBottom: 4,
            }}
          >
            SUM OF ITEM AMOUNT
          </div>
          {Object.entries(itemByCurrency).map(([cur, amt]) => (
            <div key={cur} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <input
                value={cur}
                readOnly
                style={{
                  width: 60,
                  border: `1px solid ${C.inputBorder}`,
                  borderRadius: 4,
                  padding: "4px 6px",
                  background: "#eef2f5",
                }}
              />
              <input
                value={money(amt)}
                readOnly
                style={{
                  flex: 1,
                  border: `1px solid ${C.inputBorder}`,
                  borderRadius: 4,
                  padding: "4px 6px",
                  background: "#eef2f5",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={gridStyle}>
        <SummaryInputBox
          label="APPROVED BY"
          value={data.ApprovedBy}
          onChange={(v) => set("ApprovedBy", v)}
        />
        <SummaryInputBox
          label="CUSTOMER REMARKS"
          value={data.CustomerRemarks}
          onChange={(v) => set("CustomerRemarks", v)}
          wide
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.navy }}>
          TRADER REMARKS
        </div>
        <button type="button" onClick={showPermitFunction} style={btnStyle}>
          PREV PERMIT NUMBER
        </button>
        <button type="button" onClick={showExRate} style={btnStyle}>
          EX. RATE
        </button>
        <SummaryInputBox
          label="FORMAT REMARKS"
          value={data.FormatRemark}
          onChange={(v) => set("FormatRemark", v)}
        />
        <button type="button" onClick={applyFormatRemark} style={btnStyle}>
          CONFIG
        </button>
        <SummaryInputBox
          label="CROSS REFERENCE"
          value={data.CrossReference}
          onChange={(v) => set("CrossReference", v)}
          wide
        />
      </div>

      <textarea
        value={data.TradeRemarks || ""}
        onChange={(e) => set("TradeRemarks", e.target.value)}
        style={{
          width: "100%",
          minHeight: 90,
          boxSizing: "border-box",
          padding: 8,
          fontSize: 12.5,
          border: `1px solid ${C.inputBorder}`,
          borderRadius: 4,
          marginBottom: 12,
          fontFamily: "inherit",
        }}
      />

      <SummaryInputBox
        label="INTERNAL REMARKS"
        value={data.InternalRemarks}
        onChange={(v) => set("InternalRemarks", v)}
      />

      <div
        style={{
          background: C.bar,
          color: C.barText,
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: 0.4,
          textAlign: "center",
          padding: "8px 0",
          borderRadius: 4,
          margin: "16px 0 10px",
        }}
      >
        DECLARATION SUMMARY
      </div>

      <div style={gridStyle}>
        <SummaryInputBox
          label="IMPORTER"
          value={`${importer.CRUEI || ""}-${importer.Name || ""}`}
          readOnly
          wide
        />
        <SummaryInputBox label="HAWB/HBL" value={data.Hawb} readOnly wide />
        <SummaryInputBox label="MAWB/OBL" value={data.Mawb} readOnly wide />
        <SummaryInputBox
          label="GROSS WEIGHT"
          value={`${data.TotalGrossWeight || ""}-${data.TotalGrossWeightUnit || ""}`}
          readOnly
          wide
        />
        <SummaryInputBox
          label="NO OF PACKING"
          value={`${data.TotalOuterPack || ""}-${data.TotalOuterPackUnit || ""}`}
          readOnly
          wide
        />
        <SummaryInputBox
          label="TOTAL ITEM GST"
          value={money(totalItemGst)}
          readOnly
          wide
        />
        <SummaryInputBox
          label="INVOICE AMOUNT"
          value={Object.entries(invoiceByCurrency)
            .map(([c, a]) => `${c} : ${money(a)}`)
            .join(", ")}
          readOnly
          wide
        />
        <SummaryInputBox
          label="TOTAL INVOICE GST"
          value={money(totalItemGst)}
          readOnly
          wide
        />
      </div>

      <div
        style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}
      >
        <input
          type="checkbox"
          checked={!!data.DeclarationChecked}
          onChange={(e) => set("DeclarationChecked", e.target.checked)}
          style={{ width: 16, height: 16, accentColor: C.bar }}
        />
        <span style={{ fontSize: 12.5, color: C.navy, fontWeight: 600 }}>
          I/WE DECLARE THAT ALL PARTICULARS IN THIS APPLICATION ARE TRUE AND
          CORRECT
        </span>
      </div>
    </div>
  );
}

const btnStyle = {
  border: "none",
  background: C.bar,
  color: "#fff",
  fontWeight: 700,
  fontSize: 10,
  padding: "4px 9px",
  borderRadius: 3,
  cursor: "pointer",
};

function seedHeaderDefaults(d) {
  let result = d;
  HEADER_FIELD_SPECS.forEach((spec) => {
    if (spec.default === undefined) return;
    const existingKey = findRowKey(result, spec.aliases);
    const raw = existingKey ? result[existingKey] : undefined;
    const hasValue = raw !== undefined && raw !== null && raw !== "";
    if (!hasValue) {
      result = setDeep(result, [existingKey || spec.key], spec.default);
    }
  });
  return result;
}

function seedCargoUnitDefaults(d) {
  let result = d;
  const seedUnit = (spec) => {
    const unitKey = findRowKey(result, spec.unitAliases);
    const hasUnit = unitKey && result[unitKey];
    if (!hasUnit && spec.defaultUnit) {
      result = setDeep(
        result,
        [unitKey || `${spec.key}Unit`],
        spec.defaultUnit,
      );
    }
  };
  seedUnit(CARGO_FIELD_SPECS.totalOuterPack);
  seedUnit(CARGO_FIELD_SPECS.totalGrossWeight);
  return result;
}

function seedHawbDefault(d) {
  const hawbKey = findRowKey(d, CARGO_FIELD_SPECS.hawb.aliases);
  const hasHawb = hawbKey && d[hawbKey];
  if (hasHawb) return d;

  const consignmentNoKey = findRowKey(d, ["consignmentno"]);
  const consignmentNo = consignmentNoKey ? d[consignmentNoKey] : "";
  if (!consignmentNo) return d;

  return setDeep(d, [hawbKey || CARGO_FIELD_SPECS.hawb.key], consignmentNo);
}

function seedTotalGrossWeightDefault(d) {
  const grossKey = findRowKey(d, CARGO_FIELD_SPECS.totalGrossWeight.aliases);
  const hasGross = grossKey && d[grossKey] !== "" && d[grossKey] != null;
  if (hasGross) return d;

  const totalWeightKey = findRowKey(d, ["totalweight"]);
  const totalWeight = totalWeightKey ? d[totalWeightKey] : "";
  if (totalWeight === "" || totalWeight == null) return d;

  return setDeep(
    d,
    [grossKey || CARGO_FIELD_SPECS.totalGrossWeight.key],
    String(totalWeight),
  );
}

export default function DeclarationPanel({ email, declaration, onSave, busy }) {
  const buildData = (raw) =>
    seedHawbDefault(
      seedTotalGrossWeightDefault(
        seedCargoUnitDefaults(
          seedHeaderDefaults(
            deepUpperCaseTopLevelExcept(
              raw ?? blankDeclaration(),
              HEADER_SELECT_KEYS,
            ),
          ),
        ),
      ),
    );
  const buildAll = (raw) => {
    const rawList = normalizeDeclarations(raw);
    return rawList.map((r) => buildData(r ?? blankDeclaration()));
  };

  const [dataList, setDataList] = useState(() => buildAll(declaration));
  const [pageIndex, setPageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("header");

  const buildInitialIdentities = (list) =>
    list.map((d) => {
      const permitKey = findRowKey(d, ["permitid"]);
      const permitVal = permitKey ? d[permitKey] : "";
      if (!permitVal) return null; // fresh declaration — needs explicit "New"
      const jobKey = findRowKey(d, ["jobid"]);
      const msgKey = findRowKey(d, ["msgid"]);
      return {
        PermitId: permitVal,
        JobId: jobKey ? d[jobKey] : "",
        MSGId: msgKey ? d[msgKey] : "",
        Refid: d.Refid || "",
        TradeNetMailboxID: d.TradeNetMailboxID || "",
        DeclarantCompanyCode: d.DeclarantCompanyCode || d.DeclarantCode || "",
        source: "existing",
      };
    });

  const [pageIdentities, setPageIdentities] = useState(() =>
    buildInitialIdentities(buildAll(declaration)),
  );
  const [generatingNew, setGeneratingNew] = useState(false);

  useEffect(() => {
    const list = buildAll(declaration);
    setDataList(list);
    setPageIndex(0);
    setActiveTab("header");
    setPageIdentities(buildInitialIdentities(list));
    setGeneratingNew(false);
  }, [declaration, email?.id]);

  const data = dataList[pageIndex] || blankDeclaration();
  const hasMultiple = dataList.length > 1;

  const handleUseSinglePermitForAll = async () => {
    if (!hasMultiple) return;

    setGeneratingNew(true);
    try {
      let identity = pageIdentities[pageIndex];
      if (!identity) {
        const res = await API.get(`inpaymentnew/?user=${DEFAULT_TOUCH_USER}`);
        if (!res.data?.PermitId) throw new Error("Failed to generate PermitId");
        identity = {
          PermitId: res.data.PermitId,
          JobId: res.data.JobId,
          MSGId: res.data.MsgId,
          Refid: res.data.RefId,
          TradeNetMailboxID: res.data.TradeNetMailboxID,
          DeclarantCompanyCode: res.data.DeclarantCode,
          source: "generated",
        };
      }

      setPageIdentities((prev) => prev.map(() => identity));
      setDataList((prev) =>
        prev.map((d) => setDeep(d, ["PermitId"], identity.PermitId)),
      );
    } catch (err) {
      console.error("Use single permit failed:", err);
      alert(
        "Failed to set a single Permit ID for all declarations. Please try again.",
      );
    } finally {
      setGeneratingNew(false);
    }
  };

  const handleNewPermit = async (idx = pageIndex) => {
    setGeneratingNew(true);
    try {
      const res = await API.get(`inpaymentnew/?user=${DEFAULT_TOUCH_USER}`);
      if (!res.data?.PermitId) throw new Error("Failed to generate PermitId");

      const identity = {
        PermitId: res.data.PermitId,
        JobId: res.data.JobId,
        MSGId: res.data.MsgId,
        Refid: res.data.RefId,
        TradeNetMailboxID: res.data.TradeNetMailboxID,
        DeclarantCompanyCode: res.data.DeclarantCode,
        source: "generated",
      };

      setPageIdentities((prev) => {
        const next = prev.slice();
        next[idx] = identity;
        return next;
      });
      setDataList((prev) =>
        prev.map((d, i) =>
          i === idx ? setDeep(d, ["PermitId"], identity.PermitId) : d,
        ),
      );
    } catch (err) {
      console.error("New permit failed:", err);
      alert("Failed to generate a new Permit ID. Please try again.");
    } finally {
      setGeneratingNew(false);
    }
  };

  const handleEdit = (path, value) => {
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

  const withSupplierDefault = (d) => {
    const supplierCode = d.invoice?.supplier?.code;
    if (!supplierCode || !String(supplierCode).trim()) {
      return setDeep(d, ["invoice", "supplier", "code"], "-");
    }
    return d;
  };

  const postHeader = async (d, ids) => {
    const items = Array.isArray(d.items) ? d.items : [];
    const invoices = Array.isArray(d.invoices) ? d.invoices : [];

    const toNum = (v) => {
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    };

    const totalCIFFOBValue = invoices.reduce(
      (sum, inv) => sum + toNum(inv?.costInsuranceFreight?.amountSgd),
      0,
    );
    const totalGSTTaxAmt = invoices.reduce(
      (sum, inv) => sum + toNum(inv?.gst?.amountSgd),
      0,
    );

    const payload = {
      PermitId: ids.PermitId,
      JobId: ids.JobId,
      MSGId: ids.MSGId,
      Refid: ids.Refid,
      TradeNetMailboxID: ids.TradeNetMailboxID,
      DeclarantCompanyCode: ids.DeclarantCompanyCode,
      MessageType: d.MessageType || "IPTDEC",
      DeclarationType: d.DeclarationType,
      PreviousPermit: d.PreviousPermitNo,
      CargoPackType: d.CargoPackType,
      InwardTransportMode: d.InwardTransportMode,
      BGIndicator: d.BgIndicator,
      SupplyIndicator: d.SupplyIndicator,
      ReferenceDocuments: d.ReferenceDocument,
      ImporterCompanyCode: d.Importer?.Code,
      InwardCarrierAgentCode: d.InwardCarrierAgent?.Code,
      FreightForwarderCode: d.FreightForwarder?.Code,
      ClaimantPartyCode: d.ClaimantParty?.Code,
      HBL: d.Hawb,
      ArrivalDate: toApiDate(d.ArrivalDate),
      LoadingPortCode: d.LoadingPort?.Code,
      FlightNO: d.FlightNumber,
      AircraftRegNo: d.AircraftRegNo,
      MasterAirwayBill: d.Mawb,
      ReleaseLocation: d.ReleaseLocation?.Code,
      ResLoaName: d.ReleaseLocation?.Name,
      RecepitLocation: d.ReceiptLocation?.Code,
      RecepitLocName: d.ReceiptLocation?.Name,
      TotalOuterPack: d.TotalOuterPack,
      TotalOuterPackUOM: d.TotalOuterPackUnit,
      TotalGrossWeight: d.TotalGrossWeight,
      TotalGrossWeightUOM: d.TotalGrossWeightUnit,
      PermitGrossWeight: d.PermitGrossWeight,
      BlanketStartDate: toApiDate(d.BlanketStartDate),

      NumberOfItems: items.length,
      TotalCIFFOBValue: totalCIFFOBValue,
      TotalGSTTaxAmt: totalGSTTaxAmt,
      TotalExDutyAmt: 0,
      TotalCusDutyAmt: 0,
      TotalODutyAmt: 0,
      TotalAmtPay: totalGSTTaxAmt,
      Status: "LLMNEW",
      prmtStatus: "NEW",
      PermitNumber: "",
      Cnb: "N",
      DeclareIndicator: "Y",
      DeclarningFor: "--Select--",
      GrossReference: "",
      TradeRemarks: "",
      InternalRemarks: "",
      CustomerRemarks: "",

      TouchUser: DEFAULT_TOUCH_USER,
      TouchTime: new Date().toISOString(),
    };

    // ← NEW: log the exact payload being sent
    console.log("postCommonHeaderTable payload:", payload);

    await API.post("/postCommonHeaderTable/", payload);
  };

  const handleSaveCurrent = async () => {
    const ids = pageIdentities[pageIndex];
    if (!ids) {
      alert('Click "New" first to generate a Permit ID for this declaration.');
      return;
    }
    try {
      const toSave = withSupplierDefault(
        setDeep(data, ["PermitId"], ids.PermitId),
      );

      await postHeader(toSave, ids);

      if (hasMultiple) {
        onSave(toSave, pageIndex);
      } else {
        onSave(toSave);
      }
    } catch (err) {
      console.error("Save failed:", err);
      if (ids.source === "generated") {
        setPageIdentities((prev) => {
          const next = prev.slice();
          next[pageIndex] = null;
          return next;
        });
      }
      alert(
        (err.message || "Failed to save.") +
          (ids.source === "generated"
            ? " Please click New again to retry with a new Permit ID."
            : " Please try saving again."),
      );
    }
  };

  const handleSaveAll = async () => {
    const missing = dataList.map((_, i) => i).filter((i) => !pageIdentities[i]);
    if (missing.length) {
      alert(
        `Click "New" first for declaration page(s): ${missing.map((i) => i + 1).join(", ")}`,
      );
      return;
    }
    try {
      for (let i = 0; i < dataList.length; i++) {
        const ids = pageIdentities[i];
        const d = withSupplierDefault(
          setDeep(dataList[i], ["PermitId"], ids.PermitId),
        );
        await postHeader(d, ids);
        onSave(d, i);
      }
    } catch (err) {
      console.error("Save all failed:", err);
      alert(
        (err.message || "Failed to save all.") +
          " Please retry the failed page(s).",
      );
    }
  };

  const currentIdentity = pageIdentities[pageIndex];
  const canSave = !!email && !busy && !!data && !!currentIdentity;

  return (
    <aside className="declaration-panel">
      <div className="decl-toolbar">
        <button className="decl-button decl-button-amber">Draft</button>
        <button className="decl-button decl-button-red">Query</button>
        <button
          className="decl-button"
          disabled={generatingNew}
          onClick={() => handleNewPermit(pageIndex)}
          title="Generate a new Permit ID for this declaration only"
        >
          {generatingNew ? "Generating…" : "New"}
        </button>
        {hasMultiple && (
          <button
            className="decl-button"
            disabled={generatingNew}
            onClick={handleUseSinglePermitForAll}
            title="Use one shared Permit ID across all declarations found in this email"
          >
            {generatingNew ? "Generating…" : "Use One Permit For All"}
          </button>
        )}
        {activeTab === "summary" && (
          <div className="decl-body-save">
            <button
              className="decl-button decl-button-verdigris"
              disabled={!canSave}
              onClick={handleSaveCurrent}
            >
              {busy ? "Saving…" : hasMultiple ? "Save Page" : "Save"}
            </button>
          </div>
        )}
      </div>

      <div className="decl-scroll">
        <div className="decl-header">
          <div>
            <h2>{email?.subject || "Untitled declaration"}</h2>
            <div className="decl-sub">{email?.sender || ""}</div>
            {currentIdentity?.PermitId && (
              <div className="decl-sub" style={{ fontWeight: 700 }}>
                Permit ID: {currentIdentity.PermitId}
              </div>
            )}
          </div>
          {email && <StatusStamp status={email.status} />}
        </div>

        {hasMultiple && (
          <DeclarationPageBar
            dataList={dataList}
            activeIndex={pageIndex}
            onChange={setPageIndex}
            pageIdentities={pageIdentities}
          />
        )}

        <div className="decl-body">
          {!currentIdentity ? (
            <div
              style={{
                border: `1px dashed ${C.panelBorder}`,
                borderRadius: 8,
                padding: 24,
                textAlign: "center",
                color: C.sub,
                background: "#fafcfd",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 8,
                  color: C.navy,
                }}
              >
                No Permit ID yet
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 14 }}>
                Click <strong>New</strong> above to generate a Permit ID before
                editing this declaration.
              </div>
              <button
                className="decl-button decl-button-verdigris"
                disabled={generatingNew}
                onClick={() => handleNewPermit(pageIndex)}
              >
                {generatingNew ? "Generating…" : "New"}
              </button>
            </div>
          ) : (
            <>
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
                <InvoiceTabContent
                  data={data}
                  onEdit={handleEdit}
                  permitId={currentIdentity?.PermitId}
                />
              )}
              {activeTab === "items" && (
                <ItemsTabContent
                  data={data}
                  onEdit={handleEdit}
                  permitId={currentIdentity?.PermitId}
                  user={{ username: DEFAULT_TOUCH_USER }}
                />
              )}
              {activeTab === "summary" && (
                <SummaryTabContent data={data} onEdit={handleEdit} />
              )}
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
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
