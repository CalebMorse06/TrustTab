import { Trip, Expense } from "./types";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), ".data");
const TRIPS_FILE = join(DATA_DIR, "trips.json");
const EXPENSES_FILE = join(DATA_DIR, "expenses.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadTrips(): Map<string, Trip> {
  try {
    if (existsSync(TRIPS_FILE)) {
      const raw = readFileSync(TRIPS_FILE, "utf-8");
      const entries: [string, Trip][] = JSON.parse(raw);
      return new Map(entries);
    }
  } catch (e) {
    console.error("Failed to load trips:", e);
  }
  return new Map();
}

function loadExpenses(): Map<string, Expense> {
  try {
    if (existsSync(EXPENSES_FILE)) {
      const raw = readFileSync(EXPENSES_FILE, "utf-8");
      const entries: [string, Expense][] = JSON.parse(raw);
      return new Map(entries);
    }
  } catch (e) {
    console.error("Failed to load expenses:", e);
  }
  return new Map();
}

function saveTrips(trips: Map<string, Trip>) {
  ensureDir();
  writeFileSync(TRIPS_FILE, JSON.stringify(Array.from(trips.entries()), null, 2));
}

function saveExpenses(expenses: Map<string, Expense>) {
  ensureDir();
  writeFileSync(EXPENSES_FILE, JSON.stringify(Array.from(expenses.entries()), null, 2));
}

// Use globalThis for hot-reload persistence + file system for restart persistence
const globalStore = globalThis as unknown as {
  __tripTreasury_trips?: Map<string, Trip>;
  __tripTreasury_expenses?: Map<string, Expense>;
  __tripTreasury_loaded?: boolean;
};

if (!globalStore.__tripTreasury_loaded) {
  globalStore.__tripTreasury_trips = loadTrips();
  globalStore.__tripTreasury_expenses = loadExpenses();
  globalStore.__tripTreasury_loaded = true;
}

const trips = globalStore.__tripTreasury_trips!;
const expenses = globalStore.__tripTreasury_expenses!;

export const store = {
  // Trips
  getTrip(id: string): Trip | undefined {
    return trips.get(id);
  },
  getAllTrips(): Trip[] {
    return Array.from(trips.values());
  },
  setTrip(trip: Trip): void {
    trips.set(trip.id, trip);
    saveTrips(trips);
  },
  deleteTrip(id: string): boolean {
    const result = trips.delete(id);
    saveTrips(trips);
    return result;
  },

  // Expenses
  getExpense(id: string): Expense | undefined {
    return expenses.get(id);
  },
  getExpensesByTrip(tripId: string): Expense[] {
    return Array.from(expenses.values()).filter((e) => e.tripId === tripId);
  },
  setExpense(expense: Expense): void {
    expenses.set(expense.id, expense);
    // Also update trip's expenses array
    const trip = trips.get(expense.tripId);
    if (trip) {
      const idx = trip.expenses.findIndex((e) => e.id === expense.id);
      if (idx >= 0) {
        trip.expenses[idx] = expense;
      } else {
        trip.expenses.push(expense);
      }
      trips.set(trip.id, trip);
      saveTrips(trips);
    }
    saveExpenses(expenses);
  },

  // Reset
  clear(): void {
    trips.clear();
    expenses.clear();
    saveTrips(trips);
    saveExpenses(expenses);
  },
};
