import { Trip, Expense } from "./types";

// Use globalThis to persist across hot reloads and module re-evaluations
const globalStore = globalThis as unknown as {
  __tripTreasury_trips?: Map<string, Trip>;
  __tripTreasury_expenses?: Map<string, Expense>;
};

if (!globalStore.__tripTreasury_trips) {
  globalStore.__tripTreasury_trips = new Map<string, Trip>();
}
if (!globalStore.__tripTreasury_expenses) {
  globalStore.__tripTreasury_expenses = new Map<string, Expense>();
}

const trips = globalStore.__tripTreasury_trips;
const expenses = globalStore.__tripTreasury_expenses;

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
  },
  deleteTrip(id: string): boolean {
    return trips.delete(id);
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
    }
  },

  // Reset
  clear(): void {
    trips.clear();
    expenses.clear();
  },
};
