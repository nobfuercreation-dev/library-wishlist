const STORAGE_KEY = "library-wishlist-books";

const elements = {
  form: document.getElementById("book-form"),
  title: document.getElementById("book-title"),
  author: document.getElementById("book-author"),
  library: document.getElementById("book-library"),
  note: document.getElementById("book-note"),
  submitBtn: document.getElementById("submit-btn"),
  cancelEditBtn: document.getElementById("cancel-edit-btn"),
  searchInput: document.getElementById("library-search"),
  searchBtn: document.getElementById("search-btn"),
  clearSearchBtn: document.getElementById("clear-search-btn"),
  searchResultLabel: document.getElementById("search-result-label"),
  librarySuggestions: document.getElementById("library-suggestions"),
  bookList: document.getElementById("book-list"),
  bookCount: document.getElementById("book-count"),
  exportBtn: document.getElementById("export-btn"),
  importInput: document.getElementById("import-input"),
  bookItemTemplate: document.getElementById("book-item-template"),
};

let books = loadBooks();
let editingId = null;
let activeLibraryFilter = "";

function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function createId() {
  return crypto.randomUUID();
}

function getLibraryNames() {
  return [...new Set(books.map((book) => book.library))].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

function updateLibrarySuggestions() {
  elements.librarySuggestions.innerHTML = getLibraryNames()
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function findMatchingLibrary(input) {
  const query = normalizeText(input);
  if (!query) return "";

  const exact = books.find((book) => book.library === query);
  if (exact) return exact.library;

  const lowerQuery = query.toLowerCase();
  const matches = getLibraryNames().filter((name) =>
    name.toLowerCase().includes(lowerQuery)
  );

  if (matches.length === 1) return matches[0];
  return query;
}

function getFilteredBooks() {
  if (!activeLibraryFilter) return [...books];

  const filter = activeLibraryFilter.toLowerCase();
  return books.filter((book) => book.library.toLowerCase().includes(filter));
}

function renderBookItem(book) {
  const node = elements.bookItemTemplate.content.cloneNode(true);

  node.querySelector(".book-title").textContent = book.title;

  const metaParts = [book.library];
  if (book.author) metaParts.unshift(book.author);
  node.querySelector(".book-meta").textContent = metaParts.join(" ／ ");

  const noteEl = node.querySelector(".book-note");
  if (book.note) {
    noteEl.textContent = book.note;
  }

  node.querySelector(".edit-btn").addEventListener("click", () => startEdit(book.id));
  node.querySelector(".delete-btn").addEventListener("click", () => deleteBook(book.id));

  return node;
}

function renderGroupedList(filteredBooks) {
  if (filteredBooks.length === 0) {
    elements.bookList.innerHTML =
      activeLibraryFilter
        ? `<p class="empty-state">「${escapeHtml(activeLibraryFilter)}」に該当する本は見つかりませんでした。</p>`
        : `<p class="empty-state">まだ本が登録されていません。上のフォームから追加してください。</p>`;
    return;
  }

  if (activeLibraryFilter) {
    elements.bookList.innerHTML = "";
    filteredBooks
      .sort((a, b) => a.title.localeCompare(b.title, "ja"))
      .forEach((book) => {
        elements.bookList.appendChild(renderBookItem(book));
      });
    return;
  }

  const groups = new Map();
  filteredBooks.forEach((book) => {
    if (!groups.has(book.library)) groups.set(book.library, []);
    groups.get(book.library).push(book);
  });

  elements.bookList.innerHTML = "";
  [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ja"))
    .forEach(([library, libraryBooks]) => {
      const section = document.createElement("section");
      section.className = "library-group";

      const title = document.createElement("h3");
      title.className = "library-group-title";
      title.textContent = `${library}（${libraryBooks.length}冊）`;
      section.appendChild(title);

      libraryBooks
        .sort((a, b) => a.title.localeCompare(b.title, "ja"))
        .forEach((book) => {
          section.appendChild(renderBookItem(book));
        });

      elements.bookList.appendChild(section);
    });
}

function render() {
  const filteredBooks = getFilteredBooks();
  elements.bookCount.textContent = `${filteredBooks.length} 冊`;

  if (activeLibraryFilter) {
    elements.searchResultLabel.hidden = false;
    elements.searchResultLabel.textContent = `「${activeLibraryFilter}」の借りたい本：${filteredBooks.length}冊`;
  } else {
    elements.searchResultLabel.hidden = true;
    elements.searchResultLabel.textContent = "";
  }

  updateLibrarySuggestions();
  renderGroupedList(filteredBooks);
}

function resetForm() {
  editingId = null;
  elements.form.reset();
  elements.submitBtn.textContent = "登録する";
  elements.cancelEditBtn.hidden = true;
}

function startEdit(id) {
  const book = books.find((entry) => entry.id === id);
  if (!book) return;

  editingId = id;
  elements.title.value = book.title;
  elements.author.value = book.author;
  elements.library.value = book.library;
  elements.note.value = book.note;
  elements.submitBtn.textContent = "更新する";
  elements.cancelEditBtn.hidden = false;
  elements.title.focus();
}

function deleteBook(id) {
  const book = books.find((entry) => entry.id === id);
  if (!book) return;

  const confirmed = window.confirm(`「${book.title}」を削除しますか？`);
  if (!confirmed) return;

  books = books.filter((entry) => entry.id !== id);
  saveBooks();

  if (editingId === id) resetForm();
  render();
}

function handleSubmit(event) {
  event.preventDefault();

  const title = normalizeText(elements.title.value);
  const author = normalizeText(elements.author.value);
  const library = normalizeText(elements.library.value);
  const note = normalizeText(elements.note.value);

  if (!title || !library) return;

  if (editingId) {
    books = books.map((book) =>
      book.id === editingId ? { ...book, title, author, library, note } : book
    );
  } else {
    books.push({
      id: createId(),
      title,
      author,
      library,
      note,
      createdAt: new Date().toISOString(),
    });
  }

  saveBooks();
  resetForm();
  render();
}

function applySearch() {
  const matchedLibrary = findMatchingLibrary(elements.searchInput.value);
  activeLibraryFilter = matchedLibrary;
  render();
}

function clearSearch() {
  activeLibraryFilter = "";
  elements.searchInput.value = "";
  render();
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    books,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `library-wishlist-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const importedBooks = Array.isArray(parsed) ? parsed : parsed.books;

      if (!Array.isArray(importedBooks)) {
        throw new Error("invalid format");
      }

      const confirmed = window.confirm(
        `インポートすると現在の ${books.length} 冊のデータが置き換わります。続けますか？`
      );
      if (!confirmed) return;

      books = importedBooks
        .filter((book) => book.title && book.library)
        .map((book) => ({
          id: book.id || createId(),
          title: normalizeText(String(book.title)),
          author: normalizeText(String(book.author || "")),
          library: normalizeText(String(book.library)),
          note: normalizeText(String(book.note || "")),
          createdAt: book.createdAt || new Date().toISOString(),
        }));

      saveBooks();
      resetForm();
      clearSearch();
      render();
    } catch {
      window.alert("JSONファイルの形式が正しくありません。");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

elements.form.addEventListener("submit", handleSubmit);
elements.cancelEditBtn.addEventListener("click", resetForm);
elements.searchBtn.addEventListener("click", applySearch);
elements.clearSearchBtn.addEventListener("click", clearSearch);
elements.searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applySearch();
  }
});
elements.exportBtn.addEventListener("click", exportData);
elements.importInput.addEventListener("change", importData);

render();
