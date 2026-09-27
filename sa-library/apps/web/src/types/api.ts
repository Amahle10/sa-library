export interface Branch {
  id: string;
  libraryId: string;
  name: string;
  address: string;
  city: string;
  province: string;
  library?: Library;
}
export interface Library {
  id: string;
  name: string;
  municipality: string;
  province: string;
  branches: Branch[];
}
export interface Membership {
  membershipNumber: string;
  status: string;
  library: Library;
}
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'MEMBER' | 'LIBRARIAN' | 'LIBRARY_ADMIN' | 'PLATFORM_ADMIN';
  status: string;
  staffBranchId: string | null;
  staffBranch: Branch | null;
  memberships: Membership[];
}
export interface Availability {
  branchId: string;
  branchName: string;
  city: string;
  totalCopies: number;
  availableCopies: number;
  reservedCopies: number;
  borrowedCopies: number;
  unavailableCopies: number;
}
export interface Book {
  id: string;
  title: string;
  authors: string[];
  isbn13?: string;
  isbn10?: string;
  description?: string;
  publisher?: string;
  publishedYear?: number;
  category?: string;
  coverUrl?: string;
  language: string;
  totalCopies: number;
  availableCopies: number;
  availability: Availability[];
}
export interface Copy {
  id: string;
  bookId: string;
  branchId: string;
  barcode: string;
  shelfLocation?: string;
  condition?: string;
  status: string;
  book: Book;
  branch: Branch;
}
export interface Reservation {
  id: string;
  userId: string;
  bookId: string;
  copyId: string;
  status: string;
  reservedAt: string;
  expiresAt?: string;
  book: Book;
  copy: Copy;
  user: User;
  pickupBranch: Branch;
}
export interface Loan {
  id: string;
  status: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt?: string;
  copy: Copy;
  branch: Branch;
  user: User;
}
export interface Dashboard {
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  activeReservations: number;
  readyForCollection: number;
  overdueLoans: number;
  branches: Branch[];
}
export interface Notice {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}
