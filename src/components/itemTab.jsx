import { useState, useEffect, useRef, useMemo } from "react";
import { FaSearch, FaTrash, FaPlus } from "react-icons/fa";
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

function fmt(val, decimals = 2) {
  const num = parseFloat(val);
  return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
}

function makeCachedListHook(endpoint) {
  const cache = { list: null };
  return function useCachedList() {
    const [list, setList] = useState(() => cache.list || []);
    useEffect(() => {
      if (cache.list) {
        setList(cache.list);
        return;
      }
      let cancelled = false;
      API.get(endpoint)
        .then((res) => {
          cache.list = res.data || [];
          if (!cancelled) setList(cache.list);
        })
        .catch((err) => console.error(`Error fetching ${endpoint}`, err));
      return () => {
        cancelled = true;
      };
    }, []);
    return list;
  };
}

const useHsCodeSuggestions = makeCachedListHook("/getCommonHsCodeTableInfo/");
const useTotalOuterPackOptions = makeCachedListHook(
  "/getTotalOuterPackFromCommonMaster/",
);
const useVehicleTypeOptions = makeCachedListHook(
  "/getVehicalTypeFromCommonMaster/",
);
const useEngineCapacityOptions = makeCachedListHook(
  "/getEngineCapacityFromCommonMaster/",
);
const usePreferentialOptions = makeCachedListHook(
  "/getPreferntialFromCommonMaster/",
);
const useMakingLotOptions = makeCachedListHook(
  "/getMakingLotFromCommonMaster/",
);
const useCurrencyOptions = makeCachedListHook("/getCommonCurrencyTableInfo/");

const countryCache = { list: null };
function useCountrySuggestions() {
  const [list, setList] = useState(() => countryCache.list || []);
  useEffect(() => {
    if (countryCache.list) {
      setList(countryCache.list);
      return;
    }
    let cancelled = false;
    API.get("/getCommonCountryTableInfo/")
      .then((res) => {
        const data = (res.data || []).map(
          (i) => `${i.CountryCode}:${i.Description}`,
        );
        countryCache.list = data;
        if (!cancelled) setList(data);
      })
      .catch((err) => console.error("Error fetching country list", err));
    return () => {
      cancelled = true;
    };
  }, []);
  return list;
}

function blankCascBox() {
  return { code: "", hsQuantity: 0, uom: "", casc: [["", "", ""]] };
}

function blankItem() {
  return {
    HSCode: "",
    Description: "",
    DGIndicator: false,
    Unbranded: false,
    Brand: "",
    Model: "",
    Country: "",
    CountryDescription: "",
    Hawb: "",

    // duty-type driven visibility, recomputed whenever HS Code changes
    ShowVehicle: false,
    ShowPacking: false,
    ShowAlcohol: false,
    ShowDutiableQuantity: false,
    ShowOptionalCharges: false,
    ShowItemCasc: false,
    IsControlled: false,
    DutyTypeId: "",
    KgmVisible: "",
    CorrectUom: "",

    DutiableQty: "",
    DutiableUOM: "--Select--",
    TotalDutiableQty: "",
    TotalDutiableUOM: "--Select--",
    InvoiceQuantity: "",
    HSQty: "",
    HSUOM: "--Select--",
    AlcoholPercentage: "",

    InvoiceNo: "",
    ChkUnitPrice: false,
    UnitPrice: "",
    UnitPriceCurrency: "",
    ExchangeRate: "",
    SumExchangeRate: "0.00",
    TotalLineAmount: "",
    InvoiceCharges: "0.00",
    CIFFOB: "0.00",

    VehicleType: "",
    EngineCapacity: "",
    EngineCapacityUOM: "",
    OriginalRegDate: "",

    PreferentialCode: "",
    GSTRate: 9,
    GSTUOM: "PER",
    GSTAmount: "",
    GSTRecalculate: false,
    ExciseDutyRate: 0,
    ExciseDutyUOM: "--Select--",
    ExciseDutyAmount: "",
    CustomsDutyRate: 0,
    CustomsDutyUOM: "--Select--",
    CustomsDutyAmount: "",
    OtherTaxRate: "",
    OtherTaxUOM: "",
    OtherTaxAmount: "",
    LastSellingPrice: "",

    PackingChecked: false,
    OPQty: "0.00",
    OPUOM: "",
    IPQty: "0.00",
    IPUOM: "",
    InPQty: "0.00",
    InPUOM: "",
    ImPQty: "0.00",
    ImPUOM: "",

    ItemCascChecked: false,
    ItemCasc: [blankCascBox(), blankCascBox(), blankCascBox()],

    ShowShippingMarks: false,
    ShippingMarks1: "",
    ShippingMarks2: "",
    ShippingMarks3: "",
    ShippingMarks4: "",

    ShowLotId: false,
    CurrentLot: "",
    Making: "",
    PreviousLot: "",

    OptionalCurrency: "",
    OptionalRate: "",
    OptionalAmountInput: "",
    OptionalCharges: "",
  };
}

// ---------------------------------------------------------------------------
// Small UI atoms
// ---------------------------------------------------------------------------

function EditableInput({
  value,
  onChange,
  placeholder,
  compact = true,
  disabled,
  onBlur,
  onFocus,
  onKeyDown,
  type = "text",
  upper = true,
}) {
  return (
    <input
      type={type}
      value={value ?? ""}
      placeholder={placeholder ?? ""}
      disabled={disabled}
      onChange={(e) =>
        onChange &&
        onChange(upper ? e.target.value.toUpperCase() : e.target.value)
      }
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
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
      }}
    />
  );
}

function EditableSelect({ value, onChange, options, disabled }) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: `1px solid ${C.inputBorder}`,
        borderRadius: 4,
        padding: "5px 6px",
        fontSize: 11.5,
        color: C.navy,
        background: disabled ? C.tabIdleBg : C.inputBg,
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

function Field({ label, children, error }) {
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
      {error && (
        <span style={{ color: C.danger, fontSize: 10, fontWeight: 700 }}>
          {error}
        </span>
      )}
    </div>
  );
}

function Grid({ cols = 2, children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "10px 12px",
      }}
    >
      {children}
    </div>
  );
}

function ItemSection({ title, children, extra }) {
  return (
    <div
      style={{
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 8,
        padding: 12,
        background: "#fafcfd",
        marginBottom: 12,
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
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        color: C.navy,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 15, height: 15, accentColor: C.bar }}
      />
      {label}
    </label>
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

function SearchPopup({ title, data = [], onClose, onSelect, columns }) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  const filteredData = useMemo(
    () =>
      data.filter((item) =>
        Object.values(item)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [search, data],
  );

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 6,
          width: 700,
          maxHeight: "80%",
          overflowY: "auto",
        }}
      >
        <h4 style={{ margin: "0 0 10px", color: C.navy }}>{title}</h4>
        <input
          type="text"
          placeholder={`Search ${title}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "7px 9px",
            border: `1px solid ${C.inputBorder}`,
            borderRadius: 4,
            marginBottom: 10,
            boxSizing: "border-box",
            fontSize: 12.5,
          }}
        />
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}
        >
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    background: C.tableHead,
                    color: "#fff",
                    padding: "6px 8px",
                    textAlign: "left",
                    fontSize: 10.5,
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item, idx) => (
              <tr
                key={idx}
                onClick={() => onSelect(item)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = C.rowAlt)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    style={{
                      padding: "6px 8px",
                      borderBottom: `1px solid ${C.panelBorder}`,
                    }}
                  >
                    {item[col]}
                  </td>
                ))}
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ textAlign: "center", padding: 14, color: C.sub }}
                >
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 10,
            fontSize: 12,
            color: C.sub,
          }}
        >
          <span>
            Showing {filteredData.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, filteredData.length)} of {filteredData.length}{" "}
            entries
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                border: `1px solid ${C.inputBorder}`,
                background: "#fff",
                borderRadius: 4,
                padding: "5px 12px",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
              }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                currentPage < totalPages && setCurrentPage(currentPage + 1)
              }
              disabled={currentPage === totalPages || totalPages === 0}
              style={{
                border: `1px solid ${C.inputBorder}`,
                background: "#fff",
                borderRadius: 4,
                padding: "5px 12px",
                cursor:
                  currentPage === totalPages || totalPages === 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              Next
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 12,
            border: `1px solid ${C.inputBorder}`,
            background: "#fff",
            borderRadius: 4,
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

async function fetchProductCodePopupData(hsCode, setPopupData, setLoading) {
  setLoading(true);
  try {
    const url = hsCode
      ? `/getCascProductCodes/?HSCode=${hsCode}`
      : `/getCascProductCodes/`;
    const response = await API.get(url);
    setPopupData(response.data || []);
  } catch (err) {
    console.error("Failed to fetch product code popup data", err);
    setPopupData([]);
  } finally {
    setLoading(false);
  }
}

function ItemNumberBadge({ number, active, onClick, controlled, pending }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        controlled
          ? "Controlled item"
          : pending
            ? "Pending import — click to review"
            : undefined
      }
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: `1.5px solid ${
          controlled
            ? C.danger
            : pending
              ? "#c98a12"
              : active
                ? C.bar
                : C.panelBorder
        }`,
        background: active
          ? pending
            ? "#c98a12"
            : C.bar
          : controlled
            ? C.dangerBg
            : pending
              ? "#fff6e0"
              : "#fff",
        color: active
          ? "#fff"
          : controlled
            ? C.danger
            : pending
              ? "#946200"
              : C.navy,
        fontWeight: 800,
        fontSize: 12.5,
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {number}
    </button>
  );
}

function HsCodeInput({ value, onChangeText, onSelect, onBlurResolve }) {
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
        i.HSCode?.toLowerCase().startsWith(val.toLowerCase()) ||
        i.Description?.toLowerCase().includes(val.toLowerCase()),
    );
    const exact = matches.filter(
      (i) => i.HSCode?.toLowerCase() === val.toLowerCase(),
    );
    const finalList = exact.length > 0 ? exact : matches.slice(0, 100);
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
      setHighlighted((p) => (p + 1 >= filtered.length ? 0 : p + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((p) => (p - 1 < 0 ? filtered.length - 1 : p - 1));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleSelect(filtered[highlighted]);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!value) {
        onBlurResolve(null);
        setShowDropdown(false);
        return;
      }
      const match = suggestions.find(
        (i) => String(i.HSCode || "").toLowerCase() === value.toLowerCase(),
      );
      onBlurResolve(match || null);
      setShowDropdown(false);
    }, 150);
  };

  return (
    <div style={{ position: "relative" }}>
      <EditableInput
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
              {String(item.Inpayment) === "1" && (
                <span style={{ color: C.danger, fontWeight: 800 }}>
                  {" "}
                  (Controlled)
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CountryInput({ code, description, onCodeChange, onResolve }) {
  const suggestions = useCountrySuggestions();
  const [showDropdown, setShowDropdown] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const [highlighted, setHighlighted] = useState(0);

  const runFilter = (val) => {
    if (!val) {
      setShowDropdown(false);
      setFiltered([]);
      return;
    }
    const lower = val.toLowerCase();
    const matches = suggestions.filter((item) => {
      const [c] = item.split(":");
      return c.toLowerCase().startsWith(lower);
    });
    setFiltered(matches.slice(0, 50));
    setShowDropdown(matches.length > 0);
  };

  const handleChange = (val) => {
    onCodeChange(val);
    setHighlighted(0);
    runFilter(val);
  };

  const handleSelect = (item) => {
    const [Code, Description] = item.split(":");
    onResolve(Code, Description);
    setShowDropdown(false);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((p) => (p + 1 >= filtered.length ? 0 : p + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((p) => (p - 1 < 0 ? filtered.length - 1 : p - 1));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleSelect(filtered[highlighted]);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!code) {
        onResolve("", "");
        setShowDropdown(false);
        return;
      }
      const match = suggestions
        .map((i) => i.split(":"))
        .find(([Code]) => Code.toLowerCase() === code.toLowerCase());
      if (match) onResolve(match[0], match[1]);
      else onResolve(code, "");
      setShowDropdown(false);
    }, 150);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 6 }}>
      <div style={{ position: "relative" }}>
        <EditableInput
          value={code}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => runFilter(code)}
          onBlur={handleBlur}
          placeholder="CODE"
        />
        {showDropdown && filtered.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              minWidth: 240,
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
            {filtered.map((item, index) => {
              const [cc, desc] = item.split(":");
              return (
                <div
                  key={cc + index}
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
                  {cc} - {desc}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <EditableInput value={description} disabled placeholder="NAME" />
    </div>
  );
}

function parseHawbList(hawbStr) {
  return String(hawbStr || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ItemFieldsEditor({
  item,
  path,
  onEdit,
  invoiceNumbers,
  declarationType,
  totalGrossWeight,
  permitId,
  user,
  itemNumber,
  editingItemNo,
  onSaved,
  cargoHawbList,
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [cascPopupOpen, setCascPopupOpen] = useState(false);
  const [cascPopupData, setCascPopupData] = useState([]);
  const [cascPopupLoading, setCascPopupLoading] = useState(false);
  const [activeCascIndex, setActiveCascIndex] = useState(null);

  const totalOuterPack = useTotalOuterPackOptions();
  const vehicleTypeOptions = useVehicleTypeOptions();
  const engineCapacityOptions = useEngineCapacityOptions();
  const preferentialOptions = usePreferentialOptions();
  const makingLotOptions = useMakingLotOptions();
  const currencyOptions = useCurrencyOptions();

  const set = (field, value) => onEdit([...path, field], value);
  const effectiveHawb = editingItemNo
    ? item.Hawb || ""
    : cargoHawbList.length > 1
      ? item.Hawb || cargoHawbList[0] || ""
      : cargoHawbList[0] || item.Hawb || "";

  // ---------------- HS CODE LOGIC (ported from applyHsLogic) ----------------

  const applyHsLogic = (hsRow) => {
    if (!hsRow) return;
    const {
      HSCode,
      UOM,
      DUTYTYPID,
      Kgmvisible,
      DuitableUom,
      Excisedutyuom,
      Excisedutyrate,
      Customsdutyuom,
      Customsdutyrate,
      Inpayment,
    } = hsRow;

    set("DutyTypeId", DUTYTYPID);
    set("KgmVisible", Kgmvisible);
    set("IsControlled", String(Inpayment) === "1");

    // reset
    set("ShowVehicle", false);
    set("ShowPacking", false);
    set("ShowAlcohol", false);
    set("ShowDutiableQuantity", false);
    set("ShowOptionalCharges", false);

    set("HSUOM", UOM);
    set("CorrectUom", UOM);
    set("DutiableUOM", UOM);
    set("TotalDutiableUOM", DuitableUom);

    set("ExciseDutyRate", 0);
    set("ExciseDutyUOM", "--Select--");
    set("CustomsDutyRate", 0);
    set("CustomsDutyUOM", "--Select--");

    if (Number(hsRow.Inpayment) === 1) {
      set("ItemCascChecked", true);
      set("ShowItemCasc", true);
    } else {
      set("ItemCascChecked", false);
      set("ShowItemCasc", false);
    }

    const setDutyDefaults = () => {
      set("ExciseDutyUOM", Excisedutyuom == 0 ? "--Select--" : Excisedutyuom);
      set(
        "CustomsDutyUOM",
        Customsdutyuom == 0 ? "--Select--" : Customsdutyuom,
      );
      set("ExciseDutyRate", Excisedutyrate);
      set("CustomsDutyRate", Customsdutyrate);
    };

    if (DUTYTYPID === 62 || DUTYTYPID === 63) {
      if (DUTYTYPID === 62 && UOM === "LTR") {
        set("ShowDutiableQuantity", true);
        set("ShowAlcohol", true);
        set("ShowPacking", true);
        set("PackingChecked", true);
      } else if (
        (DUTYTYPID === 63 && UOM === "KGM") ||
        (DUTYTYPID === 62 && UOM !== "LTR")
      ) {
        set("ShowDutiableQuantity", true);
      } else {
        set("ShowDutiableQuantity", true);
        set("ShowAlcohol", true);
        set("ShowPacking", true);
        set("PackingChecked", true);
      }
      if (DuitableUom === "A") set("TotalDutiableUOM", "--Select--");
      setDutyDefaults();
    } else if (DUTYTYPID === 64) {
      if (UOM !== "LTR") {
        set("ShowDutiableQuantity", true);
        set("ShowAlcohol", false);
      } else {
        set("ShowDutiableQuantity", true);
        set("ShowAlcohol", true);
        set("ShowPacking", true);
        set("PackingChecked", true);
      }
      if (DuitableUom === "A") set("TotalDutiableUOM", "--Select--");
      setDutyDefaults();
    } else if (DUTYTYPID === 61 || DUTYTYPID === 67) {
      if (UOM === "LTR") {
        set("ShowDutiableQuantity", true);
        set("ShowAlcohol", true);
        set("ShowPacking", true);
        set("PackingChecked", true);
      } else if (UOM === "KGM") {
        set("ShowDutiableQuantity", true);
        set("ShowAlcohol", false);
      } else {
        set("ShowDutiableQuantity", false);
        set("ShowAlcohol", false);
      }
      setDutyDefaults();
    }

    // vehicle (HS code starts with 87)
    if (HSCode && HSCode.startsWith("87")) {
      set("ShowVehicle", true);
      set("ShowDutiableQuantity", true);
      set("ShowOptionalCharges", true);
      setDutyDefaults();
    }
  };

  const handleHsCodeSelect = (hsItem) => {
    set("HSCode", hsItem.HSCode);
    if (!item.Description?.trim()) {
      set("Description", hsItem.Description);
    }
    applyHsLogic(hsItem);
  };

  const handleHsCodeBlur = (resolvedRow) => {
    if (!resolvedRow) {
      if (!item.HSCode) {
        set("ShowVehicle", false);
        set("ShowPacking", false);
        set("ShowAlcohol", false);
        set("ShowDutiableQuantity", false);
        set("DutiableUOM", "--Select--");
        set("TotalDutiableUOM", "--Select--");
        set("HSUOM", "--Select--");
        set("ExciseDutyRate", 0);
        set("ExciseDutyUOM", "--Select--");
      }
      return;
    }
    set("HSCode", resolvedRow.HSCode);
    if (!item.Description?.trim()) {
      set("Description", resolvedRow.Description);
    }
    applyHsLogic(resolvedRow);
  };
  // ---------------- UOM validation (derived, no extra state) ----------------

  const hsUomError =
    item.HSUOM === "--Select--"
      ? "PLEASE CHECK UOM"
      : item.HSUOM && item.CorrectUom && item.HSUOM !== item.CorrectUom
        ? "INVALID UOM FOR THIS HS CODE"
        : "";

  // ---------------- Invoice Quantity -> HS Quantity conversion ----------------

  const itemInvoiceQuantityFunction = () => {
    const itemqty = parseFloat(item.InvoiceQuantity);
    if (!itemqty) return;
    const hsopt = item.HSUOM;
    let total;
    if (hsopt === "TEN" || hsopt === "TPR") total = itemqty / 10;
    else if (hsopt === "CEN") total = itemqty / 100;
    else if (hsopt === "MIL" || hsopt === "TNE") total = itemqty / 1000;
    else if (hsopt === "MTK") total = itemqty * 3.213;
    else if (hsopt === "LTR" || hsopt === "KGM") total = itemqty * 1;
    else total = itemqty;

    if (
      (hsopt === "KGM" || hsopt === "LTR" || hsopt === "TNE") &&
      totalGrossWeight &&
      itemqty > Number(totalGrossWeight)
    ) {
      alert(
        "The Total Gross Weight is Less Than The Sum Of The Item Weight Please Check!!!",
      );
    }

    if (item.HSQty === "0.00" || item.HSQty === "" || itemqty !== 0) {
      set("HSQty", total.toFixed(4));
    }
  };

  // ---------------- Dutiable quantity / packing calculation (duticalc) ----------------

  const recomputeDutiable = () => {
    const op = parseFloat(item.OPQty) || 0;
    const ip = parseFloat(item.IPQty) || 0;
    const inp = parseFloat(item.InPQty) || 0;
    const imp = parseFloat(item.ImPQty) || 0;
    const totduti = parseFloat(item.TotalDutiableQty) || 0;
    if (!totduti) return;

    let pckqty = 1;
    if (op > 0) pckqty = op;
    if (ip > 0) pckqty = pckqty * ip;
    if (inp > 0) pckqty = pckqty * inp;
    if (imp > 0) pckqty = pckqty * imp;

    const HsVal = item.HSCode || "";
    const typeidval = item.DutyTypeId;
    const kgmvis = item.KgmVisible;
    const T1 = parseFloat(item.ExciseDutyRate) || 0;
    const T2 = parseFloat(item.CIFFOB) || 0;
    const gstperval = (parseFloat(item.GSTRate) || 0) / 100;
    const TDQUOM = item.TotalDutiableUOM;

    let totalQty = 0;
    let excise = 0;
    let gst = 0;

    const writeExciseAndGst = (qtyForExcise) => {
      if (!HsVal.startsWith("87")) {
        excise = qtyForExcise * T1;
        set("ExciseDutyAmount", excise.toFixed(2));
      }
      gst = T2 * gstperval + excise * gstperval;
      set("GSTAmount", gst.toFixed(2));
    };

    if (TDQUOM === "LTR") {
      totalQty = pckqty * totduti;
      set("TotalDutiableQty", totalQty.toFixed(2));
      set("HSQty", totalQty.toFixed(2));
    } else if (TDQUOM === "KGM" && kgmvis === "MULTIPLE") {
      totalQty = pckqty * totduti;
      set("TotalDutiableQty", totalQty.toFixed(2));
      writeExciseAndGst(totalQty);
    } else if (TDQUOM === "KGM" && kgmvis === "DIVIDE") {
      totalQty = (pckqty * totduti) / 1000;
      set("TotalDutiableQty", totalQty.toFixed(2));
      writeExciseAndGst(totalQty);
    } else if (TDQUOM === "STK") {
      totalQty = pckqty;
      set("TotalDutiableQty", totalQty.toFixed(2));
      set("HSQty", ((pckqty * totduti) / 1000).toFixed(2));
      writeExciseAndGst(pckqty);
    } else if (
      (TDQUOM === "KGM" && (typeidval === 62 || typeidval === 61)) ||
      (TDQUOM === "TNE" && typeidval === 62) ||
      TDQUOM === "DAL"
    ) {
      totalQty = pckqty * totduti;
      set("TotalDutiableQty", totalQty.toFixed(2));
      writeExciseAndGst(totalQty);
    } else if (TDQUOM === "NMB" && HsVal.startsWith("87")) {
      excise = (T2 * T1) / 100;
      set("ExciseDutyAmount", excise.toFixed(2));
      gst = T2 * gstperval + excise * gstperval;
      set("GSTAmount", gst.toFixed(2));
    }
  };

  // ---------------- Alcohol / excise / customs / GST calc (mirrors the ----
  // ---------------- combined useEffect in legacy Item.jsx) -----------------

  useEffect(() => {
    const T1 = parseFloat(item.TotalDutiableQty) || 0;
    const T2 = parseFloat(item.AlcoholPercentage) || 0;
    const T3 = parseFloat(item.ExciseDutyRate) || 0;
    const T4 = parseFloat(item.CustomsDutyRate) || 0;
    const T5 = parseFloat(item.CIFFOB) || 0;
    const gstperval = (parseFloat(item.GSTRate) || 0) / 100;

    let exciseValue = parseFloat(item.ExciseDutyAmount) || 0;
    let T7 = parseFloat(item.CustomsDutyAmount) || 0;

    if (T1 > 0 && T2 > 0 && T3 > 0) {
      exciseValue = T1 * T2 * (T3 / 100);
      T7 = T1 * T2 * (T4 / 100);
      if (fmt(exciseValue) !== fmt(item.ExciseDutyAmount)) {
        set("ExciseDutyAmount", exciseValue.toFixed(2));
      }
      if (fmt(T7) !== fmt(item.CustomsDutyAmount)) {
        set("CustomsDutyAmount", T7.toFixed(2));
      }
    }

    let T6;
    if (declarationType !== "GST : GST (Including Duty Exemption)") {
      T6 = (exciseValue + T5 + T7) * gstperval;
    } else {
      T6 = T5 * gstperval;
    }

    if (!item.GSTRecalculate && fmt(T6) !== fmt(item.GSTAmount)) {
      set("GSTAmount", T6.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    item.TotalDutiableQty,
    item.AlcoholPercentage,
    item.ExciseDutyRate,
    item.CustomsDutyRate,
    item.CIFFOB,
    item.GSTRate,
    declarationType,
  ]);

  const gstWarning =
    Number(item.GSTAmount) >= 10000
      ? "Total GST Amount greater than 10000"
      : "";

  // ---------------- Invoice line amount / CIF-FOB calc ----------------

  const applyInvoiceChange = (invoiceNo) => {
    set("InvoiceNo", invoiceNo);
    const selected = invoiceNumbers.find((inv) => inv.InvoiceNo === invoiceNo);
    if (selected) {
      set("UnitPriceCurrency", selected.TICurrency);
      set("ExchangeRate", selected.TIExRate);
    } else {
      set("UnitPriceCurrency", "");
      set("ExchangeRate", "");
    }
  };

  const invoiceTotalLineAmountFunction = () => {
    const itotalAmount = Number(item.TotalLineAmount) || 0;
    const icurrinput = Number(item.ExchangeRate) || 0;
    let totalAmd = 0;
    let totInvoiceAmd = 0;
    invoiceNumbers.forEach((i) => {
      if (item.InvoiceNo === i.InvoiceNo) {
        totalAmd =
          Number(i.OTCSAmount) + Number(i.FCSAmount) + Number(i.ICSAmount);
        totInvoiceAmd = Number(i.TISAmount);
      }
    });
    if (totInvoiceAmd === 0) return;
    const invoiceAmd = totalAmd / totInvoiceAmd;
    const totalLineAmd = icurrinput * itotalAmount;
    const invoiceCharge = invoiceAmd * totalLineAmd;

    set("InvoiceCharges", invoiceCharge.toFixed(2));
    const total2 = totalLineAmd + invoiceCharge;
    set("CIFFOB", total2.toFixed(2));

    if ((item.HSCode || "").startsWith("87")) {
      const vehicleExcise = (total2 * Number(item.ExciseDutyRate)) / 100;
      set("ExciseDutyAmount", vehicleExcise.toFixed(2));
    }
  };

  // ---------------- Sum exchange rate (unit price section) ----------------

  useEffect(() => {
    if (!item.ChkUnitPrice) {
      if (item.SumExchangeRate !== "0.00") set("SumExchangeRate", "0.00");
      return;
    }
    const rate = parseFloat(item.ExchangeRate) || 0;
    const price = parseFloat(item.UnitPrice) || 0;
    const sum = (rate * price).toFixed(2);
    if (item.SumExchangeRate !== sum) set("SumExchangeRate", sum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.ExchangeRate, item.UnitPrice, item.ChkUnitPrice]);

  // ---------------- Optional charges (vehicle) ----------------

  const optionalChargesFunction = (val) => {
    set("OptionalAmountInput", val);
    const rate = parseFloat(item.OptionalRate) || 0;
    set("OptionalCharges", (Number(val || 0) * rate).toFixed(2));
  };

  const handleOptionalCurrencyChange = (currencyName) => {
    const match = currencyOptions.find((c) => c.Currency === currencyName);
    set("OptionalCurrency", currencyName);
    set("OptionalRate", match ? match.CurrencyRate : "");
  };

  // ---------------- Last selling price ----------------

  const lastSellingPriceFunction = () => {
    const exciseAmt = parseFloat(item.ExciseDutyAmount) || 0;
    const gstRate = parseFloat(item.GSTRate) || 0;
    const lastPrice = parseFloat(item.LastSellingPrice);
    if (lastPrice > 0) {
      const gstOnExcise = (exciseAmt * gstRate) / 100;
      const totalGst = (lastPrice * gstRate) / 100 + gstOnExcise;
      set("GSTAmount", totalGst.toFixed(2));
    }
  };

  // ---------------- Preferential code ----------------

  const itemPreferentialCodeOut = (value) => {
    set("PreferentialCode", value);
    if (value === "PRF : if goods are imported under preferential duty rates") {
      set("CustomsDutyRate", "0.00");
      set("CustomsDutyUOM", "--Select--");
      set("CustomsDutyAmount", "0.00");
    }
  };

  // ---------------- Unbranded / DG indicator ----------------

  const handleUnbrandedChange = (checked) => {
    set("Unbranded", checked);
    set("Brand", checked ? "UNBRANDED" : "");
  };

  const togglePacking = (checked) => {
    set("PackingChecked", checked);
    set("ShowPacking", checked);
    if (!checked) {
      set("OPQty", "0.00");
      set("OPUOM", "");
      set("IPQty", "0.00");
      set("IPUOM", "");
      set("InPQty", "0.00");
      set("InPUOM", "");
      set("ImPQty", "0.00");
      set("ImPUOM", "");
    }
  };

  const toggleItemCasc = (checked) => {
    set("ItemCascChecked", checked);
    set("ShowItemCasc", checked);
    if (!checked)
      set("ItemCasc", [blankCascBox(), blankCascBox(), blankCascBox()]);
  };

  // ---------------- Item CASC handlers ----------------

  const copyHsQty = (cIndex) => {
    const updated = item.ItemCasc.slice();
    updated[cIndex] = {
      ...updated[cIndex],
      hsQuantity: item.HSQty,
      uom: item.HSUOM,
    };
    set("ItemCasc", updated);
  };

  const handleCascFieldChange = (cIndex, field, value) => {
    const updated = item.ItemCasc.slice();
    updated[cIndex] = { ...updated[cIndex], [field]: value };
    set("ItemCasc", updated);
  };

  const handleCascTableChange = (cIndex, rowIndex, colIndex, value) => {
    const updated = item.ItemCasc.map((box) => ({
      ...box,
      casc: box.casc.map((row) => row.slice()),
    }));
    if (!updated[cIndex].casc[rowIndex]) {
      updated[cIndex].casc[rowIndex] = ["", "", ""];
    }
    updated[cIndex].casc[rowIndex][colIndex] = value;
    set("ItemCasc", updated);
  };

  const addCascRow = (cIndex) => {
    const updated = item.ItemCasc.map((box) => ({
      ...box,
      casc: box.casc.map((row) => row.slice()),
    }));
    updated[cIndex].casc.push(["", "", ""]);
    set("ItemCasc", updated);
  };

  const deleteCascRow = (cIndex, rowIndex) => {
    const updated = item.ItemCasc.map((box) => ({
      ...box,
      casc: box.casc.map((row) => row.slice()),
    }));
    updated[cIndex].casc.splice(rowIndex, 1);
    set("ItemCasc", updated);
  };

  // ---------------- CASC product-code search popup ----------------

  const handleCascSearchClick = (cIndex) => {
    setActiveCascIndex(cIndex);
    setCascPopupOpen(true);
    fetchProductCodePopupData(
      item.HSCode,
      setCascPopupData,
      setCascPopupLoading,
    );
  };

  const handleCascProductSelect = (selectedItem) => {
    if (activeCascIndex === null) return;
    const updated = item.ItemCasc.slice();
    updated[activeCascIndex] = {
      ...updated[activeCascIndex],
      code: selectedItem.CASCCode,
      uom: selectedItem.UOM,
    };
    set("ItemCasc", updated);
    setCascPopupOpen(false);
    setActiveCascIndex(null);
  };

  // ---------------- Lot id / shipping marks toggles ----------------

  // ---------------- Lot id / shipping marks toggles ----------------

  const toggleLotId = (checked) => {
    set("ShowLotId", checked);
    if (!checked) {
      set("CurrentLot", "");
      set("Making", "");
      set("PreviousLot", "");
    }
  };

  const toggleShippingMarks = (checked) => {
    set("ShowShippingMarks", checked);
    if (!checked) {
      set("ShippingMarks1", "");
      set("ShippingMarks2", "");
      set("ShippingMarks3", "");
      set("ShippingMarks4", "");
    }
  };

  const validateItem = () => {
    const errors = {};
    if (!item.HSCode?.trim()) errors.HSCode = "FILL HSCODE";
    if (!item.Description?.trim())
      errors.Description = "FILL HSCODE DESCRIPTION";
    if (!item.Country?.trim()) errors.Country = "FILL COO";
    if (!item.Brand?.trim()) errors.Brand = "FILL BRAND";
    if (item.HSQty === "" || Number(item.HSQty) === 0)
      errors.HSQty = "FILL HS QUANTITY";
    if (item.HSUOM === "--Select--" || !item.HSUOM)
      errors.HSUOM = "PLEASE CHECK UOM";
    if (!item.InvoiceNo) errors.InvoiceNo = "CHOOSE INVOICE";
    if (item.TotalLineAmount === "" || Number(item.TotalLineAmount) === 0) {
      errors.TotalLineAmount = "FILL TOTAL LINE AMOUNT";
    }
    if (item.ItemCascChecked && !item.ItemCasc?.[0]?.code?.trim()) {
      errors.ItemCasc = "Please Check The Item Casc";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildCascPayload = (itemNo) => {
    const username = user?.username || "";
    const messageType = "IPTDEC";
    return (item.ItemCasc || []).flatMap((box, boxIndex) => {
      if (!box.code) return [];
      const hasRowData = (box.casc || []).some((row) =>
        row.some((cell) => cell !== ""),
      );
      if (!hasRowData) {
        return [
          {
            ItemNo: itemNo,
            ProductCode: box.code,
            Quantity: box.hsQuantity || 0,
            ProductUOM: box.uom || "",
            RowNo: 1,
            CascCode1: "",
            CascCode2: "",
            CascCode3: "",
            PermitId: permitId,
            MessageType: messageType,
            TouchUser: username,
            TouchTime: new Date().toISOString(),
            EndUserDes: "",
            CASCId: `Casc${boxIndex + 1}`,
          },
        ];
      }
      return box.casc
        .filter((row) => row.some((cell) => cell !== ""))
        .map((row, rowIndex) => ({
          ItemNo: itemNo,
          ProductCode: box.code,
          Quantity: box.hsQuantity || 0,
          ProductUOM: box.uom || "",
          RowNo: rowIndex + 1,
          CascCode1: row[0] || "",
          CascCode2: row[1] || "",
          CascCode3: row[2] || "",
          PermitId: permitId,
          MessageType: messageType,
          TouchUser: username,
          TouchTime: new Date().toISOString(),
          EndUserDes: "",
          CASCId: `Casc${boxIndex + 1}`,
        }));
    });
  };

  const buildItemPayload = (itemNo) => ({
    CascDatas: JSON.stringify(buildCascPayload(itemNo)),
    PermitId: permitId,
    ItemNo: itemNo,
    MessageType: "IPTDEC",
    HSCode: item.HSCode || "",
    Description: (item.Description || "").toUpperCase(),
    DGIndicator: item.DGIndicator ? "Yes" : "No",
    Contry: item.Country || "",
    EndUserDescription: "",
    Brand: item.Brand || "",
    Model: item.Model || "",
    InHAWBOBL: effectiveHawb || "",
    OutHAWBOBL: "",
    DutiableQty: item.DutiableQty || 0,
    DutiableUOM: item.DutiableUOM || "",
    TotalDutiableQty: item.TotalDutiableQty || 0,
    TotalDutiableUOM: item.TotalDutiableUOM || "",
    InvoiceQuantity: item.InvoiceQuantity || 0,
    HSQty: item.HSQty || 0,
    HSUOM: item.HSUOM || "",
    AlcoholPer: item.AlcoholPercentage || 0,
    InvoiceNo: item.InvoiceNo || "",
    ChkUnitPrice: item.ChkUnitPrice === true,
    UnitPrice: item.UnitPrice || 0,
    UnitPriceCurrency: item.UnitPriceCurrency || "",
    ExchangeRate: item.ExchangeRate || 0,
    SumExchangeRate: item.SumExchangeRate || 0,
    TotalLineAmount: item.TotalLineAmount || 0,
    InvoiceCharges: item.InvoiceCharges || 0,
    CIFFOB: Number(item.CIFFOB || 0).toFixed(2),
    OPQty: item.OPQty || 0,
    OPUOM: item.OPUOM || "",
    IPQty: item.IPQty || 0,
    IPUOM: item.IPUOM || "",
    InPqty: item.InPQty || 0,
    InPUOM: item.InPUOM || "",
    ImPQty: item.ImPQty || 0,
    ImPUOM: item.ImPUOM || "",
    PreferentialCode: item.PreferentialCode || "",
    GSTRate: item.GSTRate,
    GSTUOM: item.GSTUOM || "",
    GSTAmount: item.GSTAmount || 0,
    ExciseDutyRate: item.ExciseDutyRate || 0,
    ExciseDutyUOM: item.ExciseDutyUOM || "",
    ExciseDutyAmount: item.ExciseDutyAmount || 0,
    CustomsDutyRate: item.CustomsDutyRate || 0,
    CustomsDutyUOM: item.CustomsDutyUOM || "",
    CustomsDutyAmount: item.CustomsDutyAmount || 0,
    OtherTaxRate: item.OtherTaxRate || 0,
    OtherTaxUOM: item.OtherTaxUOM || "",
    OtherTaxAmount: item.OtherTaxAmount || 0,
    LSPValue: item.LastSellingPrice || 0,
    CurrentLot: item.CurrentLot || "",
    PreviousLot: item.PreviousLot || "",
    Making: item.Making || "",
    ShippingMarks1: item.ShippingMarks1 || "",
    ShippingMarks2: item.ShippingMarks2 || "",
    ShippingMarks3: item.ShippingMarks3 || "",
    ShippingMarks4: item.ShippingMarks4 || "",
    TouchUser: (user?.username || "").toUpperCase(),
    TouchTime: new Date().toISOString(),
    VehicleType: item.VehicleType || "",
    OptionalChrgeUOM: item.OptionalCurrency || "",
    EngineCapcity: item.EngineCapacity || "",
    Optioncahrge: item.OptionalCharges || 0,
    OptionalSumtotal: item.OptionalAmountInput || 0,
    OptionalSumExchage: item.OptionalRate || 0,
    EngineCapUOM: item.EngineCapacityUOM || "",
    orignaldatereg: item.OriginalRegDate || "",
  });

  const handleSaveItem = async () => {
    setSaveError("");
    if (!permitId) {
      setSaveError(
        'Click "New" first to generate a Permit ID before saving an item.',
      );
      return;
    }
    if (!validateItem()) return;

    const itemNo = editingItemNo || itemNumber;
    const payload = buildItemPayload(itemNo);

    setIsSaving(true);
    try {
      const res = await API.post("/postItemWithCasc/", payload);
      if (res.data?.Warning) alert(res.data.Warning);
      onSaved({ ...item, Hawb: effectiveHawb, ItemNo: itemNo });
    } catch (error) {
      console.error("Save failed", error);
      setSaveError(
        error.response?.data?.error ||
          error.response?.data?.Result ||
          "Failed to save item, check console for details",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const packUomOptions = totalOuterPack.map((t) => t.Name).filter(Boolean);

  return (
    <div>
      {/* HEADER ROW */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              color: C.navy,
              fontWeight: 800,
              fontSize: 12.5,
              letterSpacing: 0.3,
            }}
          >
            {editingItemNo
              ? `Editing Item ${editingItemNo}`
              : `New Item ${itemNumber}`}
          </span>
          {item.IsControlled && (
            <span
              style={{
                background: C.dangerBg,
                color: C.danger,
                fontWeight: 800,
                fontSize: 10.5,
                padding: "3px 8px",
                borderRadius: 12,
              }}
            >
              CONTROLLED ITEM
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSaveItem}
          disabled={isSaving}
          style={{
            border: "none",
            background: isSaving ? "#90caf9" : C.bar,
            color: "#fff",
            fontWeight: 700,
            fontSize: 11.5,
            padding: "6px 14px",
            borderRadius: 6,
            cursor: isSaving ? "not-allowed" : "pointer",
          }}
        >
          {isSaving ? "Saving…" : editingItemNo ? "Update Item" : "Save Item"}
        </button>
      </div>
      {saveError && (
        <div
          style={{
            color: C.danger,
            fontWeight: 700,
            fontSize: 11.5,
            marginBottom: 10,
          }}
        >
          {saveError}
        </div>
      )}

      {/* BASIC DETAILS */}
      <ItemSection title="Basic Details">
        <Grid cols={2}>
          <Field label="HAWB / HBL">
            {editingItemNo ? (
              <EditableInput
                value={item.Hawb}
                onChange={(v) => set("Hawb", v)}
              />
            ) : cargoHawbList.length > 1 ? (
              <EditableSelect
                value={effectiveHawb}
                onChange={(v) => set("Hawb", v)}
                options={cargoHawbList}
              />
            ) : (
              <EditableInput
                value={effectiveHawb}
                disabled
                onChange={() => {}}
              />
            )}
          </Field>
          <Field label="HS Code">
            <HsCodeInput
              value={item.HSCode}
              onChangeText={(v) => set("HSCode", v)}
              onSelect={handleHsCodeSelect}
              onBlurResolve={handleHsCodeBlur}
            />
          </Field>
        </Grid>
        <div style={{ marginTop: 10 }}>
          <Field label="Description" error={fieldErrors.Description}>
            <textarea
              value={item.Description ?? ""}
              onChange={(e) => set("Description", e.target.value)}
              style={{
                border: `1px solid ${C.inputBorder}`,
                borderRadius: 4,
                padding: "7px 9px",
                fontSize: 12,
                color: C.navy,
                width: "100%",
                minHeight: 60,
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </Field>
        </div>
        <div style={{ marginTop: 10 }}>
          <Grid cols={2}>
            <Field label="Country of Origin (COO)" error={fieldErrors.Country}>
              <CountryInput
                code={item.Country}
                description={item.CountryDescription}
                onCodeChange={(v) => set("Country", v)}
                onResolve={(code, desc) => {
                  set("Country", code);
                  set("CountryDescription", desc);
                }}
              />
            </Field>
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <Checkbox
                checked={item.DGIndicator}
                onChange={(v) => set("DGIndicator", v)}
                label="DG Indicator"
              />
              <Checkbox
                checked={item.Unbranded}
                onChange={handleUnbrandedChange}
                label="Unbranded"
              />
            </div>
          </Grid>
        </div>
        <div style={{ marginTop: 10 }}>
          <Grid cols={2}>
            <Field label="Brand" error={fieldErrors.Brand}>
              <EditableInput
                value={item.Brand}
                onChange={(v) => set("Brand", v)}
              />
            </Field>
            <Field label="Model">
              <EditableInput
                value={item.Model}
                onChange={(v) => set("Model", v)}
              />
            </Field>
          </Grid>
        </div>
      </ItemSection>

      {/* VEHICLE */}
      {item.ShowVehicle && (
        <ItemSection title="Vehicle Details">
          <Grid cols={3}>
            <Field label="Vehicle Type">
              <EditableSelect
                value={item.VehicleType}
                onChange={(v) => set("VehicleType", v)}
                options={vehicleTypeOptions.map((v) => v.Name)}
              />
            </Field>
            <Field label="Engine Capacity">
              <EditableInput
                value={item.EngineCapacity}
                onChange={(v) => set("EngineCapacity", v)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Engine Capacity UOM">
              <EditableSelect
                value={item.EngineCapacityUOM}
                onChange={(v) => set("EngineCapacityUOM", v)}
                options={engineCapacityOptions.map((v) => v.Name)}
              />
            </Field>
          </Grid>
          <div style={{ marginTop: 10 }}>
            <Field label="Original Registration Date">
              <EditableInput
                value={item.OriginalRegDate}
                onChange={(v) => set("OriginalRegDate", v)}
                placeholder="DD/MM/YYYY"
                upper={false}
              />
            </Field>
          </div>
        </ItemSection>
      )}

      {/* QUANTITIES */}
      <ItemSection title="Quantities">
        <Grid cols={2}>
          {item.ShowDutiableQuantity && (
            <Field label="Dutiable Quantity">
              <div style={{ display: "flex", gap: 6 }}>
                <EditableInput
                  value={item.DutiableQty}
                  onChange={(v) => set("DutiableQty", v)}
                  placeholder="0.00"
                />
                <EditableSelect
                  value={item.DutiableUOM}
                  onChange={(v) => set("DutiableUOM", v)}
                  options={packUomOptions}
                />
              </div>
            </Field>
          )}
          <Field label="Total Dutiable Quantity">
            <div style={{ display: "flex", gap: 6 }}>
              <EditableInput
                value={item.TotalDutiableQty}
                onChange={(v) => set("TotalDutiableQty", v)}
                onBlur={recomputeDutiable}
                placeholder="0.00"
              />
              <EditableSelect
                value={item.TotalDutiableUOM}
                onChange={(v) => set("TotalDutiableUOM", v)}
                options={packUomOptions}
              />
            </div>
          </Field>
          <Field label="Invoice Quantity">
            <EditableInput
              value={item.InvoiceQuantity}
              onChange={(v) => set("InvoiceQuantity", v)}
              onBlur={itemInvoiceQuantityFunction}
              placeholder="0.00"
            />
          </Field>
          <Field label="HS Quantity" error={hsUomError || fieldErrors.HSQty}>
            <div style={{ display: "flex", gap: 6 }}>
              <EditableInput
                value={item.HSQty}
                onChange={(v) => set("HSQty", v)}
                placeholder="0.00"
              />
              <EditableSelect
                value={item.HSUOM}
                onChange={(v) => set("HSUOM", v)}
                options={packUomOptions}
              />
            </div>
          </Field>
          {item.ShowAlcohol && (
            <Field label="Alcohol Percentage (%)">
              <EditableInput
                value={item.AlcoholPercentage}
                onChange={(v) => set("AlcoholPercentage", v)}
                placeholder="0.00"
              />
            </Field>
          )}
        </Grid>
      </ItemSection>

      {/* INVOICE & PRICING */}
      <ItemSection title="Invoice & Pricing">
        <Grid cols={2}>
          <Field label="Invoice Number" error={fieldErrors.InvoiceNo}>
            <EditableSelect
              value={item.InvoiceNo}
              onChange={applyInvoiceChange}
              options={invoiceNumbers.map((i) => i.InvoiceNo).filter(Boolean)}
            />
          </Field>
          <Field label="Currency / Ex.Rate">
            <div style={{ display: "flex", gap: 6 }}>
              <EditableInput value={item.UnitPriceCurrency} disabled />
              <EditableInput value={item.ExchangeRate} disabled />
            </div>
          </Field>
        </Grid>

        <div style={{ marginTop: 10 }}>
          <Checkbox
            checked={item.ChkUnitPrice}
            onChange={(v) => set("ChkUnitPrice", v)}
            label="Unit Price (Auto)"
          />
        </div>
        {item.ChkUnitPrice && (
          <div style={{ marginTop: 10 }}>
            <Grid cols={2}>
              <Field label="Unit Price">
                <EditableInput
                  value={item.UnitPrice}
                  onChange={(v) => set("UnitPrice", v)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Sum Exchange Rate">
                <EditableInput value={item.SumExchangeRate} disabled />
              </Field>
            </Grid>
          </div>
        )}

        {item.ShowOptionalCharges && (
          <div style={{ marginTop: 10 }}>
            <Grid cols={3}>
              <Field label="Optional Charge Currency">
                <EditableSelect
                  value={item.OptionalCurrency}
                  onChange={handleOptionalCurrencyChange}
                  options={currencyOptions.map((c) => c.Currency)}
                />
              </Field>
              <Field label="Optional Amount">
                <EditableInput
                  value={item.OptionalAmountInput}
                  onChange={optionalChargesFunction}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Optional Charges ($)">
                <EditableInput value={item.OptionalCharges} disabled />
              </Field>
            </Grid>
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <Grid cols={2}>
            <Field
              label="Total Line Amount"
              error={fieldErrors.TotalLineAmount}
            >
              <EditableInput
                value={item.TotalLineAmount}
                onChange={(v) => set("TotalLineAmount", v)}
                onBlur={invoiceTotalLineAmountFunction}
                placeholder="0.00"
              />
            </Field>
            <Field label="Total Invoice Charge (SGD)">
              <EditableInput value={item.InvoiceCharges} disabled />
            </Field>
            <Field label="CIF / FOB (SGD)">
              <EditableInput value={item.CIFFOB} disabled />
            </Field>
            <Field label="Last Selling Price (SGD)">
              <EditableInput
                value={item.LastSellingPrice}
                onChange={(v) => set("LastSellingPrice", v)}
                onBlur={lastSellingPriceFunction}
                placeholder="0.00"
              />
            </Field>
          </Grid>
        </div>
      </ItemSection>

      {/* TAX TABLE */}
      <ItemSection title="Duty & Tax">
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr>
                {["Item", "Rate", "UOM", "Amount ($)"].map((h) => (
                  <th
                    key={h}
                    style={{
                      background: C.tableHead,
                      color: "#fff",
                      padding: "7px 9px",
                      textAlign: "left",
                      fontSize: 10.5,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: C.rowAlt }}>
                <td style={{ padding: "7px 9px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.GSTRecalculate}
                      onChange={(e) => set("GSTRecalculate", e.target.checked)}
                      style={{ accentColor: C.bar }}
                    />
                    GST (recalc)
                  </label>
                </td>
                <td style={{ padding: 6 }}>
                  <EditableInput
                    value={item.GSTRate}
                    onChange={(v) => set("GSTRate", v)}
                  />
                </td>
                <td style={{ padding: 6 }}>
                  <EditableInput value={item.GSTUOM} disabled />
                </td>
                <td style={{ padding: 6 }}>
                  <EditableInput
                    value={item.GSTAmount}
                    onChange={(v) => set("GSTAmount", v)}
                    disabled={!item.GSTRecalculate}
                    placeholder="0.00"
                  />
                </td>
              </tr>
              <tr>
                <td style={{ padding: "7px 9px" }}>Excise Duty</td>
                <td style={{ padding: 6 }}>
                  <EditableInput value={item.ExciseDutyRate} disabled />
                </td>
                <td style={{ padding: 6 }}>
                  <EditableInput value={item.ExciseDutyUOM} disabled />
                </td>
                <td style={{ padding: 6 }}>
                  <EditableInput value={item.ExciseDutyAmount} disabled />
                </td>
              </tr>
              <tr style={{ background: C.rowAlt }}>
                <td style={{ padding: "7px 9px" }}>Customs Duty</td>
                <td style={{ padding: 6 }}>
                  <EditableInput value={item.CustomsDutyRate} disabled />
                </td>
                <td style={{ padding: 6 }}>
                  <EditableInput value={item.CustomsDutyUOM} disabled />
                </td>
                <td style={{ padding: 6 }}>
                  <EditableInput value={item.CustomsDutyAmount} disabled />
                </td>
              </tr>
              <tr>
                <td style={{ padding: "7px 9px" }}>Other Tax</td>
                <td style={{ padding: 6 }}>
                  <EditableInput
                    value={item.OtherTaxRate}
                    onChange={(v) => set("OtherTaxRate", v)}
                  />
                </td>
                <td style={{ padding: 6 }}>
                  <EditableSelect
                    value={item.OtherTaxUOM}
                    onChange={(v) => set("OtherTaxUOM", v)}
                    options={packUomOptions}
                  />
                </td>
                <td style={{ padding: 6 }}>
                  <EditableInput
                    value={item.OtherTaxAmount}
                    onChange={(v) => set("OtherTaxAmount", v)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {gstWarning && (
          <div
            style={{
              color: C.danger,
              fontSize: 11,
              fontWeight: 700,
              marginTop: 6,
            }}
          >
            {gstWarning}
          </div>
        )}
      </ItemSection>

      {/* ADDITIONAL FEATURES */}
      <ItemSection title="Additional Features">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          <Checkbox
            checked={item.PackingChecked}
            onChange={togglePacking}
            label="Packing Info"
          />
          <Checkbox
            checked={item.ItemCascChecked}
            onChange={toggleItemCasc}
            label="Item CASC"
          />
          <Checkbox
            checked={item.ShowShippingMarks}
            onChange={toggleShippingMarks}
            label="Shipping Marks"
          />
          <Checkbox
            checked={item.ShowLotId}
            onChange={toggleLotId}
            label="Lot ID"
          />
        </div>
        {fieldErrors.ItemCasc && (
          <div
            style={{
              color: C.danger,
              fontSize: 10,
              fontWeight: 700,
              marginTop: 6,
            }}
          >
            {fieldErrors.ItemCasc}
          </div>
        )}
        <div style={{ marginTop: 10, maxWidth: 320 }}>
          <Field label="Preferential Code">
            <EditableSelect
              value={item.PreferentialCode}
              onChange={itemPreferentialCodeOut}
              options={preferentialOptions.map((p) => p.Name)}
            />
          </Field>
        </div>
      </ItemSection>

      {/* PACKING */}
      {item.ShowPacking && (
        <ItemSection title="Packing Details">
          <Grid cols={2}>
            {[
              ["Outer Pack Quantity", "OPQty", "OPUOM"],
              ["In Pack Quantity", "IPQty", "IPUOM"],
              ["Inner Pack Quantity", "InPQty", "InPUOM"],
              ["Inmost Pack Quantity", "ImPQty", "ImPUOM"],
            ].map(([label, qtyKey, uomKey]) => (
              <Field label={label} key={qtyKey}>
                <div style={{ display: "flex", gap: 6 }}>
                  <EditableInput
                    value={item[qtyKey]}
                    onChange={(v) => set(qtyKey, v)}
                    onBlur={recomputeDutiable}
                    placeholder="0.00"
                  />
                  <EditableSelect
                    value={item[uomKey]}
                    onChange={(v) => set(uomKey, v)}
                    options={packUomOptions}
                  />
                </div>
              </Field>
            ))}
          </Grid>
        </ItemSection>
      )}

      {/* ITEM CASC */}
      {item.ShowItemCasc && (
        <ItemSection title="Item CASC">
          {item.ItemCasc.map((box, cIndex) => (
            <div
              key={cIndex}
              style={{
                border: `1px solid ${C.panelBorder}`,
                borderRadius: 6,
                padding: 10,
                marginBottom: 10,
                background: cIndex % 2 ? C.rowAlt : "#fff",
              }}
            >
              <Grid cols={4}>
                <Field label={`Product Code ${cIndex + 1}`}>
                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <FaSearch
                      style={{ cursor: "pointer", flexShrink: 0, color: C.bar }}
                      onClick={() => handleCascSearchClick(cIndex)}
                      title="Search product code"
                    />
                    <EditableInput
                      value={box.code}
                      onChange={(v) => handleCascFieldChange(cIndex, "code", v)}
                    />
                  </div>
                </Field>
                <Field label="HS Quantity">
                  <div style={{ display: "flex", gap: 6 }}>
                    <EditableInput
                      value={box.hsQuantity}
                      onChange={(v) =>
                        handleCascFieldChange(cIndex, "hsQuantity", v)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => copyHsQty(cIndex)}
                      title="Copy HS Quantity"
                      style={{
                        border: `1px solid ${C.bar}`,
                        background: "#fff",
                        color: C.bar,
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "0 8px",
                        cursor: "pointer",
                      }}
                    >
                      COPY
                    </button>
                  </div>
                </Field>
                <Field label="UOM">
                  <EditableSelect
                    value={box.uom}
                    onChange={(v) => handleCascFieldChange(cIndex, "uom", v)}
                    options={packUomOptions}
                  />
                </Field>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <AddBtn
                    onClick={() => addCascRow(cIndex)}
                    label="+ CASC Row"
                  />
                </div>
              </Grid>

              <div style={{ overflowX: "auto", marginTop: 8 }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr>
                      {["CASC Code 1", "CASC Code 2", "CASC Code 3", ""].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              background: C.tableHead,
                              color: "#fff",
                              padding: "6px 8px",
                              fontSize: 10,
                              textAlign: "left",
                            }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(box.casc.length ? box.casc : [["", "", ""]]).map(
                      (row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, colIndex) => (
                            <td key={colIndex} style={{ padding: 5 }}>
                              <EditableInput
                                value={cell}
                                onChange={(v) =>
                                  handleCascTableChange(
                                    cIndex,
                                    rowIndex,
                                    colIndex,
                                    v,
                                  )
                                }
                              />
                            </td>
                          ))}
                          <td style={{ padding: 5, textAlign: "center" }}>
                            <FaTrash
                              style={{ cursor: "pointer", color: C.danger }}
                              onClick={() => deleteCascRow(cIndex, rowIndex)}
                            />
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </ItemSection>
      )}

      {/* LOT ID */}
      {item.ShowLotId && (
        <ItemSection title="Lot ID">
          <Grid cols={3}>
            <Field label="Current Lot">
              <EditableInput
                value={item.CurrentLot}
                onChange={(v) => set("CurrentLot", v)}
              />
            </Field>
            <Field label="Making">
              <EditableSelect
                value={item.Making}
                onChange={(v) => set("Making", v)}
                options={makingLotOptions.map((m) => m.Name)}
              />
            </Field>
            <Field label="Previous Lot">
              <EditableInput
                value={item.PreviousLot}
                onChange={(v) => set("PreviousLot", v)}
              />
            </Field>
          </Grid>
        </ItemSection>
      )}

      {/* SHIPPING MARKS */}
      {item.ShowShippingMarks && (
        <ItemSection title="Shipping Marks">
          <Grid cols={4}>
            {[
              "ShippingMarks1",
              "ShippingMarks2",
              "ShippingMarks3",
              "ShippingMarks4",
            ].map((key, i) => (
              <Field label={`Marks ${i + 1}`} key={key}>
                <textarea
                  value={item[key] ?? ""}
                  onChange={(e) => set(key, e.target.value.toUpperCase())}
                  style={{
                    border: `1px solid ${C.inputBorder}`,
                    borderRadius: 4,
                    padding: "6px 8px",
                    fontSize: 11.5,
                    width: "100%",
                    minHeight: 50,
                    resize: "vertical",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </Field>
            ))}
          </Grid>
        </ItemSection>
      )}
      {cascPopupOpen && (
        <SearchPopup
          title="PRODUCT CODE"
          data={cascPopupData}
          columns={["CASCCode", "Description", "UOM"]}
          onClose={() => {
            setCascPopupOpen(false);
            setActiveCascIndex(null);
          }}
          onSelect={handleCascProductSelect}
        />
      )}
    </div>
  );
}

function normalizeIncomingItem(raw) {
  if (!raw || typeof raw !== "object") return blankItem();
  const base = { ...blankItem(), ...raw };

  const findValue = (keys) => {
    for (const k of Object.keys(raw)) {
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (keys.includes(norm) && raw[k] !== "" && raw[k] != null) {
        return raw[k];
      }
    }
    return undefined;
  };

  if (!base.HSCode) {
    const v = findValue(["code", "hscode", "hs_code", "commoditycode"]);
    if (v !== undefined) base.HSCode = v;
  }
  if (!base.Description) {
    const v = findValue(["description", "desc"]);
    if (v !== undefined) base.Description = v;
  }
  if (!base.TotalLineAmount) {
    const v = findValue(["totalvalue", "total_value", "totallineamount"]);
    if (v !== undefined) base.TotalLineAmount = v;
  }
  if (!base.InvoiceQuantity) {
    const v = findValue(["quantity", "qty"]);
    if (v !== undefined) base.InvoiceQuantity = v;
  }
  if (!base.Country) {
    const v = findValue(["country", "countryoforigin", "coo"]);
    if (v !== undefined) base.Country = v;
  }

  return base;
}

function ItemsTableRow({ item, onEdit, onDelete, deleting }) {
  return (
    <tr style={{ background: "#fff" }}>
      <td
        style={{
          padding: 6,
          textAlign: "center",
          borderBottom: `1px solid ${C.panelBorder}`,
        }}
      >
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          title="Delete item"
          style={{
            border: "none",
            background: "#fdeceb",
            color: C.danger,
            width: 26,
            height: 26,
            borderRadius: 6,
            cursor: deleting ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          x
        </button>
      </td>
      <td
        style={{
          padding: 6,
          textAlign: "center",
          borderBottom: `1px solid ${C.panelBorder}`,
        }}
      >
        <button
          type="button"
          onClick={onEdit}
          title="Edit item"
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
          color: item.IsControlled ? C.danger : C.navy,
          fontWeight: item.IsControlled ? 800 : 400,
        }}
      >
        {item.ItemNo}
      </td>
      <td
        style={{
          padding: "7px 9px",
          borderBottom: `1px solid ${C.panelBorder}`,
          fontSize: 12,
          color: C.navy,
        }}
      >
        {item.HSCode || "—"}
      </td>
      <td
        style={{
          padding: "7px 9px",
          borderBottom: `1px solid ${C.panelBorder}`,
          fontSize: 12,
          color: C.navy,
        }}
      >
        {item.Description || "—"}
      </td>
      <td
        style={{
          padding: "7px 9px",
          borderBottom: `1px solid ${C.panelBorder}`,
          fontSize: 12,
          color: C.navy,
        }}
      >
        {item.Country || "—"}
      </td>
      <td
        style={{
          padding: "7px 9px",
          borderBottom: `1px solid ${C.panelBorder}`,
          fontSize: 12,
          color: C.navy,
        }}
      >
        {item.Hawb || "—"}
      </td>
      <td
        style={{
          padding: "7px 9px",
          borderBottom: `1px solid ${C.panelBorder}`,
          fontSize: 12,
          color: C.navy,
        }}
      >
        {item.UnitPriceCurrency || "—"}
      </td>
      <td
        style={{
          padding: "7px 9px",
          borderBottom: `1px solid ${C.panelBorder}`,
          fontSize: 12,
          color: C.navy,
        }}
      >
        {fmt(item.CIFFOB, 2)}
      </td>
      <td
        style={{
          padding: "7px 9px",
          borderBottom: `1px solid ${C.panelBorder}`,
          fontSize: 12,
          color: C.navy,
        }}
      >
        {fmt(item.HSQty, 4)}
      </td>
      <td
        style={{
          padding: "7px 9px",
          borderBottom: `1px solid ${C.panelBorder}`,
          fontSize: 12,
          color: C.navy,
        }}
      >
        {item.HSUOM || "—"}
      </td>
      <td
        style={{
          padding: "7px 9px",
          borderBottom: `1px solid ${C.panelBorder}`,
          fontSize: 12,
          color: C.navy,
        }}
      >
        {fmt(item.GSTAmount, 2)}
      </td>
      <td
        style={{
          padding: "7px 9px",
          borderBottom: `1px solid ${C.panelBorder}`,
          fontSize: 12,
          color: C.navy,
        }}
      >
        {fmt(item.TotalLineAmount, 2)}
      </td>
    </tr>
  );
}

function ItemsTableSection({ items, onEditRow, onDeleteRow, deletingItemNo }) {
  const columns = [
    "Delete",
    "Edit",
    "Item No",
    "HS Code",
    "Description",
    "COO",
    "HAWB",
    "Currency",
    "CIF/FOB ($)",
    "HS Qty",
    "HS UOM",
    "GST ($)",
    "Line Amount",
  ];
  return (
    <div style={{ marginTop: 16 }}>
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
        ITEM TABLE
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}
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
            {items.length === 0 ? (
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
                  No items added yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <ItemsTableRow
                  key={item.ItemNo}
                  item={item}
                  onEdit={() => onEditRow(item.ItemNo)}
                  onDelete={() => onDeleteRow(item.ItemNo)}
                  deleting={deletingItemNo === item.ItemNo}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function hasSavedItemNo(raw) {
  if (!raw || typeof raw !== "object") return false;
  for (const k of Object.keys(raw)) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (norm === "itemno" && raw[k] !== "" && raw[k] != null) {
      return true;
    }
  }
  return false;
}

export default function ItemsTabContent({ data, onEdit, permitId, user }) {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const cargoHawbList = parseHawbList(data.Hawb);

  const savedRawItems = rawItems.filter(hasSavedItemNo);
  const unsavedRawItems = rawItems.filter((i) => !hasSavedItemNo(i));

  const normalizedItems = savedRawItems.map(normalizeIncomingItem);

  // selection: which badge is currently loaded into the draft form.
  // { type: "saved", itemNo }  -> editing an already-saved item
  // { type: "pending", index } -> previewing/editing an unsaved n8n item
  // { type: "blank" }          -> fresh "New Item" form
  const [selection, setSelection] = useState(() =>
    unsavedRawItems.length > 0
      ? { type: "pending", index: 0 }
      : { type: "blank" },
  );

  const [deletingItemNo, setDeletingItemNo] = useState(null);
  const [invoiceNumbers, setInvoiceNumbers] = useState([]);

  useEffect(() => {
    if (!permitId) {
      setInvoiceNumbers([]);
      return;
    }
    const fetchInvoices = async () => {
      const response = await API.get(`/getInvoiceByPermitId/${permitId}/`);
      setInvoiceNumbers(response.data || []);
    };
    fetchInvoices();
  }, [permitId]);

  const nextItemNo =
    normalizedItems.length > 0
      ? Math.max(...normalizedItems.map((i) => Number(i.ItemNo) || 0)) + 1
      : 1;

  const editingItemNo = selection.type === "saved" ? selection.itemNo : null;

  // Number shown in the badge / "New Item N" label for the pending draft.
  const pendingBadgeNo =
    selection.type === "pending" ? nextItemNo + selection.index : null;

  // ---------------- Load draft whenever selection changes ----------------

  const loadSavedIntoDraft = (itemNoOrIndex) => {
    const row =
      typeof itemNoOrIndex === "number" &&
      !savedRawItems.some((i) => i.ItemNo === itemNoOrIndex)
        ? savedRawItems[itemNoOrIndex]
        : savedRawItems.find((i) => i.ItemNo === itemNoOrIndex);
    if (!row) return;

    const normalized = normalizeIncomingItem(row);
    const matchedInvoice = invoiceNumbers.find(
      (inv) => inv.InvoiceNo === normalized.InvoiceNo,
    );
    const draft = matchedInvoice
      ? {
          ...normalized,
          UnitPriceCurrency: matchedInvoice.TICurrency,
          ExchangeRate: matchedInvoice.TIExRate,
        }
      : normalized;

    onEdit(["itemDraft"], draft);
    setSelection({ type: "saved", itemNo: row.ItemNo ?? itemNoOrIndex });
  };

  const loadPendingIntoDraft = (index) => {
    const raw = unsavedRawItems[index];
    if (!raw) return;
    // As-is from the n8n response — HSCode, Description, TotalLineAmount,
    // InvoiceQuantity come straight from normalizeIncomingItem's mapping.
    // HAWB is NOT taken from here; effectiveHawb below always sources it
    // from the Cargo tab instead.
    onEdit(["itemDraft"], normalizeIncomingItem(raw));
    setSelection({ type: "pending", index });
  };

  const handleNewItem = () => {
    onEdit(["itemDraft"], blankItem());
    setSelection({ type: "blank" });
  };

  // Prefill on first render only (selection was initialized to the first
  // pending item above) — push that data into itemDraft once.
  const itemDraft = {
    ...blankItem(),
    ...(selection.type === "pending" && !data.itemDraft
      ? normalizeIncomingItem(unsavedRawItems[selection.index])
      : {}),
    ...(data.itemDraft || {}),
  };

  const handleSaved = (savedItem) => {
    const alreadySaved = savedRawItems.some((i) => i.ItemNo === editingItemNo);
    const nextSavedItems = alreadySaved
      ? savedRawItems.map((i) => (i.ItemNo === editingItemNo ? savedItem : i))
      : [...savedRawItems, savedItem];

    // Remove the specific pending item that was just saved (whichever badge
    // was open), not blindly the first one.
    const remainingUnsaved =
      selection.type === "pending"
        ? unsavedRawItems.filter((_, idx) => idx !== selection.index)
        : unsavedRawItems;

    onEdit(["items"], [...remainingUnsaved, ...nextSavedItems]);
    onEdit(["itemDraft"], blankItem());
    setSelection({ type: "blank" });
  };

  // Combined badge click: saved item, pending item, or toggle back to blank
  // if the same badge is clicked again.
  const handleSavedBadgeClick = (itemNo) => {
    if (selection.type === "saved" && selection.itemNo === itemNo) {
      handleNewItem();
    } else {
      loadSavedIntoDraft(itemNo);
    }
  };

  const handlePendingBadgeClick = (index) => {
    if (selection.type === "pending" && selection.index === index) {
      handleNewItem();
    } else {
      loadPendingIntoDraft(index);
    }
  };

  const handleDeleteRow = async (itemNo) => {
    setDeletingItemNo(itemNo);
    try {
      await API.post("/deleteItem/", { ItemNos: [itemNo], PermitId: permitId });
      try {
        await API.post("inpayment/deleteInItem/", {
          ItemNos: [itemNo],
          PermitId: permitId,
        });
      } catch (mirrorErr) {
        alert(
          `Warning: Item No ${itemNo} was deleted from CommonItemDtl but FAILED to delete from ItemDtl. ` +
            `Please contact support or retry.\n\nError: ${mirrorErr.response?.data?.error || mirrorErr.message}`,
        );
      }
      onEdit(
        ["items"],
        [
          ...unsavedRawItems,
          ...savedRawItems.filter((i) => i.ItemNo !== itemNo),
        ],
      );
      if (editingItemNo === itemNo) {
        onEdit(["itemDraft"], blankItem());
        setSelection({ type: "blank" });
      }
    } catch (error) {
      alert(
        error.response?.data?.error ||
          "Failed to delete item, check console for details",
      );
    } finally {
      setDeletingItemNo(null);
    }
  };

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: C.sub, fontWeight: 700, fontSize: 11.5 }}>
            {normalizedItems.length}{" "}
            {normalizedItems.length === 1 ? "item" : "items"}
            {unsavedRawItems.length > 0 &&
              ` (+${unsavedRawItems.length} pending import)`}
          </span>
          <button
            type="button"
            onClick={handleNewItem}
            style={{
              border: `1.5px dashed ${C.bar}`,
              background: "transparent",
              color: C.bar,
              fontWeight: 700,
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            + New Item
          </button>
        </div>
      </div>

      {/* CIRCLE BADGES — saved items (blue) + pending n8n items (amber),
          all clickable. Clicking a pending badge loads that item's
          HSCode/Description/TotalLineAmount/InvoiceQuantity as-is into the
          form below; HAWB always comes from the Cargo tab regardless. */}
      {(normalizedItems.length > 0 || unsavedRawItems.length > 0) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {normalizedItems.map((it, idx) => (
            <ItemNumberBadge
              key={it.ItemNo ?? `saved-${idx}`}
              number={it.ItemNo ?? idx + 1}
              active={
                selection.type === "saved" && selection.itemNo === it.ItemNo
              }
              controlled={it.IsControlled}
              onClick={() => handleSavedBadgeClick(it.ItemNo ?? idx)}
            />
          ))}
          {unsavedRawItems.map((_, idx) => (
            <ItemNumberBadge
              key={`pending-${idx}`}
              number={nextItemNo + idx}
              active={selection.type === "pending" && selection.index === idx}
              pending
              onClick={() => handlePendingBadgeClick(idx)}
            />
          ))}
        </div>
      )}

      <ItemFieldsEditor
        item={itemDraft}
        path={["itemDraft"]}
        onEdit={onEdit}
        invoiceNumbers={invoiceNumbers}
        declarationType={data.DeclarationType}
        totalGrossWeight={data.TotalGrossWeight}
        permitId={permitId}
        user={user}
        itemNumber={editingItemNo || pendingBadgeNo || nextItemNo}
        editingItemNo={editingItemNo}
        onSaved={handleSaved}
        cargoHawbList={cargoHawbList}
      />

      <ItemsTableSection
        items={normalizedItems}
        onEditRow={handleSavedBadgeClick}
        onDeleteRow={handleDeleteRow}
        deletingItemNo={deletingItemNo}
      />
    </div>
  );
}
