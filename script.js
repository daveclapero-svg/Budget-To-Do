// =====================================
// STORAGE FUNCTIONS
// =====================================

function loadData(storageKey) {
  try {
    const savedData = localStorage.getItem(storageKey);

    if (savedData === null) {
      return [];
    }

    return JSON.parse(savedData);
  } catch (error) {
    return [];
  }
}

function saveData(storageKey, dataToSave) {
  try {
    const jsonData = JSON.stringify(dataToSave);
    localStorage.setItem(storageKey, jsonData);
  } catch (error) {
    // Ignore storage errors
  }
}

// =====================================
// GLOBAL VARIABLES
// =====================================

let budgetEntries = loadData("budget");
let todoTasks = loadData("tasks");
let currentFilter = "all";

// =====================================
// HELPER FUNCTIONS
// =====================================

function getElement(elementId) {
  return document.getElementById(elementId);
}

function formatPeso(amount) {
  const formattedNumber = amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return "₱" + formattedNumber;
}

function createEmptyRow(messageText) {
  const listItem = document.createElement("li");

  listItem.className = "empty";
  listItem.textContent = messageText;

  return listItem;
}

// =====================================
// DATE HELPER FUNCTIONS (new)
// A date from the date box looks like "2026-11-20"
// (year-month-day). These helpers work with that text.
// =====================================

// Today's date as text, like "2026-11-20".
function getTodayString() {
  const now = new Date();

  const year = now.getFullYear();
  let month = now.getMonth() + 1; // months start at 0, so add 1
  let day = now.getDate();

  // Add a zero in front of single digits: 5 becomes "05"
  if (month < 10) {
    month = "0" + month;
  }

  if (day < 10) {
    day = "0" + day;
  }

  return year + "-" + month + "-" + day;
}

// Turn "2026-11-20" into a real date at midnight, local time.
function makeDateFromString(dateString) {
  const parts = dateString.split("-");

  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1; // months start at 0
  const day = Number(parts[2]);

  return new Date(year, month, day);
}

// Show a date nicely, like "Nov 20, 2026".
function formatDueDate(dateString) {
  return makeDateFromString(dateString).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// How many days from today until the due date?
//   negative = already late, 0 = today, 1 = tomorrow, and so on
function getDaysUntil(dateString) {
  const dueDate = makeDateFromString(dateString);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((dueDate - today) / millisecondsPerDay);
}

// Work out the reminder text and style for one task.
// style is "overdue", "today", "soon" or "" (nothing special).
function getDueInfo(task) {
  // Older tasks saved before this feature have no date.
  if (!task.dueDate) {
    return { text: "No due date", style: "" };
  }

  const formattedDate = formatDueDate(task.dueDate);

  // Finished tasks need no reminder.
  if (task.done === true) {
    return { text: "Due " + formattedDate, style: "" };
  }

  const daysLeft = getDaysUntil(task.dueDate);

  if (daysLeft < 0) {
    const daysLate = -daysLeft;

    let dayWord = " days";
    if (daysLate === 1) {
      dayWord = " day";
    }

    return {
      text: "Due " + formattedDate + " · Overdue by " + daysLate + dayWord,
      style: "overdue",
    };
  }

  if (daysLeft === 0) {
    return { text: "Due today", style: "today" };
  }

  if (daysLeft === 1) {
    return { text: "Due tomorrow", style: "soon" };
  }

  if (daysLeft <= 3) {
    return { text: "Due in " + daysLeft + " days", style: "soon" };
  }

  return { text: "Due " + formattedDate, style: "" };
}

// Put the tasks in order: earliest due date first.
// Tasks with no date go to the end.
function sortTasksByDueDate() {
  todoTasks.sort(function (firstTask, secondTask) {
    const firstDate = firstTask.dueDate || "9999-12-31";
    const secondDate = secondTask.dueDate || "9999-12-31";

    if (firstDate < secondDate) {
      return -1;
    }

    if (firstDate > secondDate) {
      return 1;
    }

    return 0;
  });
}

// The date box should not allow dates before today.
function updateDateLimit() {
  const dateBox = getElement("dueDate");

  if (dateBox !== null) {
    dateBox.min = getTodayString();
  }
}

// =====================================
// TAB FUNCTIONS
// =====================================

function showTab(tabName) {
  const tabNames = ["budget", "todo"];

  for (let tabIndex = 0; tabIndex < tabNames.length; tabIndex++) {
    const currentTabName = tabNames[tabIndex];

    if (currentTabName === tabName) {
      getElement(currentTabName).hidden = false;

      getElement("tab-" + currentTabName).setAttribute("aria-selected", "true");
    } else {
      getElement(currentTabName).hidden = true;

      getElement("tab-" + currentTabName).setAttribute(
        "aria-selected",
        "false",
      );
    }
  }

  try {
    history.replaceState(null, "", "#" + tabName);
  } catch (error) {
    // Ignore history errors
  }
}

// =====================================
// BUDGET FUNCTIONS
// =====================================

// Add up income, expenses and the balance (new: one place for this,
// so the screen and the "enough balance?" check use the same numbers).
function calculateTotals() {
  let totalIncome = 0;
  let totalExpenses = 0;

  for (let entryIndex = 0; entryIndex < budgetEntries.length; entryIndex++) {
    const currentEntry = budgetEntries[entryIndex];

    if (currentEntry.type === "income") {
      totalIncome += currentEntry.amount;
    }

    if (currentEntry.type === "expense") {
      totalExpenses += currentEntry.amount;
    }
  }

  return {
    income: totalIncome,
    expenses: totalExpenses,
    balance: totalIncome - totalExpenses,
  };
}

function drawBudget() {
  const totals = calculateTotals();

  getElement("income").textContent = formatPeso(totals.income);

  getElement("expenses").textContent = formatPeso(totals.expenses);

  let balanceSign = "";

  if (totals.balance < 0) {
    balanceSign = "−";
  }

  getElement("balance").textContent =
    balanceSign + formatPeso(Math.abs(totals.balance));

  const budgetList = getElement("budgetList");

  budgetList.innerHTML = "";

  if (budgetEntries.length === 0) {
    budgetList.appendChild(
      createEmptyRow("No entries yet. Add your first income or expense above."),
    );
  }

  for (let entryIndex = 0; entryIndex < budgetEntries.length; entryIndex++) {
    const currentEntry = budgetEntries[entryIndex];

    const listItem = document.createElement("li");

    const informationContainer = document.createElement("div");

    informationContainer.className = "grow";
    informationContainer.textContent = currentEntry.desc;

    const dateText = document.createElement("small");

    dateText.textContent = currentEntry.date;

    informationContainer.appendChild(dateText);

    const amountSpan = document.createElement("span");

    if (currentEntry.type === "income") {
      amountSpan.className = "amt in";
      amountSpan.textContent = "+" + formatPeso(currentEntry.amount);
    } else {
      amountSpan.className = "amt out";
      amountSpan.textContent = "−" + formatPeso(currentEntry.amount);
    }

    const deleteButton = document.createElement("button");

    deleteButton.className = "del";
    deleteButton.textContent = "✕";

    deleteButton.setAttribute("aria-label", "Delete " + currentEntry.desc);

    deleteButton.onclick = function () {
      // NEW: ask first. confirm() shows an OK / Cancel box.
      const question =
        "Delete this entry?\n\n" +
        currentEntry.desc +
        " (" +
        formatPeso(currentEntry.amount) +
        ")";

      if (confirm(question) === false) {
        return; // the user pressed Cancel, so do nothing
      }

      budgetEntries.splice(entryIndex, 1);

      saveData("budget", budgetEntries);

      drawBudget();
    };

    listItem.appendChild(informationContainer);
    listItem.appendChild(amountSpan);
    listItem.appendChild(deleteButton);

    budgetList.appendChild(listItem);
  }

  let budgetText = " entries";

  if (budgetEntries.length === 1) {
    budgetText = " entry";
  }

  getElement("budgetCount").textContent = budgetEntries.length + budgetText;
}

// =====================================
// BUDGET FORM
// =====================================

getElement("budgetForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const descriptionText = getElement("desc").value.trim();

  const amountText = getElement("amount").value.trim();

  const selectedType = getElement("type").value;

  const messageBox = getElement("budgetMsg");

  if (descriptionText === "" || amountText === "") {
    messageBox.textContent = "Enter a description and an amount.";

    return;
  }

  // Change the text to a number and round it to 2 decimals (centavos).
  const amountValue = Math.round(Number(amountText) * 100) / 100;

  if (Number.isNaN(amountValue) || amountValue <= 0) {
    messageBox.textContent = "The amount must be greater than 0.";

    return;
  }

  // NEW: an expense cannot be bigger than the money you have.
  if (selectedType === "expense") {
    const totals = calculateTotals();

    // Compare in centavos (whole numbers) to avoid tiny decimal errors.
    const balanceInCentavos = Math.round(totals.balance * 100);
    const amountInCentavos = Math.round(amountValue * 100);

    if (balanceInCentavos <= 0) {
      messageBox.textContent =
        "You have no balance left to spend. Add income first.";

      return;
    }

    if (amountInCentavos > balanceInCentavos) {
      messageBox.textContent =
        "Not enough balance. You have " +
        formatPeso(totals.balance) +
        " but this expense is " +
        formatPeso(amountValue) +
        ".";

      return;
    }
  }

  messageBox.textContent = "";

  const currentDate = new Date().toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  budgetEntries.unshift({
    desc: descriptionText,
    amount: amountValue,
    type: selectedType,
    date: currentDate,
  });

  saveData("budget", budgetEntries);

  drawBudget();

  getElement("desc").value = "";
  getElement("amount").value = "";

  getElement("desc").focus();
});

// =====================================
// CLEAR BUDGET
// =====================================

function clearBudget() {
  if (budgetEntries.length === 0) {
    return;
  }

  // NEW: a clearer question that shows how many entries will go.
  let entryWord = " entries";

  if (budgetEntries.length === 1) {
    entryWord = " entry";
  }

  const question =
    "Delete all " +
    budgetEntries.length +
    entryWord +
    "?\n\nThis cannot be undone.";

  if (confirm(question)) {
    budgetEntries = [];

    saveData("budget", budgetEntries);

    drawBudget();
  }
}

// =====================================
// TO-DO FUNCTIONS
// =====================================

// NEW: the reminder button under the tabs.
// It shows how many tasks are overdue or due today.
function updateReminderBox() {
  const reminderBox = getElement("reminderBox");

  if (reminderBox === null) {
    return;
  }

  let overdueCount = 0;
  let todayCount = 0;

  for (let taskIndex = 0; taskIndex < todoTasks.length; taskIndex++) {
    const dueInfo = getDueInfo(todoTasks[taskIndex]);

    if (dueInfo.style === "overdue") {
      overdueCount++;
    }

    if (dueInfo.style === "today") {
      todayCount++;
    }
  }

  // Nothing to remind about, so hide the box.
  if (overdueCount === 0 && todayCount === 0) {
    reminderBox.hidden = true;
    return;
  }

  const messageParts = [];

  if (overdueCount === 1) {
    messageParts.push("1 task overdue");
  } else if (overdueCount > 1) {
    messageParts.push(overdueCount + " tasks overdue");
  }

  if (todayCount === 1) {
    messageParts.push("1 task due today");
  } else if (todayCount > 1) {
    messageParts.push(todayCount + " tasks due today");
  }

  reminderBox.textContent = "⚠ Reminder: " + messageParts.join(" · ");

  // Red if something is late, amber if tasks are only due today.
  if (overdueCount > 0) {
    reminderBox.className = "reminder";
  } else {
    reminderBox.className = "reminder soon";
  }

  reminderBox.hidden = false;
}

function drawTodo() {
  const todoList = getElement("todoList");

  todoList.innerHTML = "";

  const tasksToShow = [];

  for (let taskIndex = 0; taskIndex < todoTasks.length; taskIndex++) {
    const currentTask = todoTasks[taskIndex];

    if (currentFilter === "all") {
      tasksToShow.push(currentTask);
    } else if (currentFilter === "done") {
      if (currentTask.done === true) {
        tasksToShow.push(currentTask);
      }
    } else {
      if (currentTask.done === false) {
        tasksToShow.push(currentTask);
      }
    }
  }

  if (tasksToShow.length === 0) {
    if (todoTasks.length === 0) {
      todoList.appendChild(
        createEmptyRow("Nothing to do yet. Add a task above."),
      );
    } else {
      todoList.appendChild(createEmptyRow("No tasks in this view."));
    }
  }

  for (let taskIndex = 0; taskIndex < tasksToShow.length; taskIndex++) {
    const currentTask = tasksToShow[taskIndex];

    const listItem = document.createElement("li");

    // NEW: the due-date reminder for this task.
    const dueInfo = getDueInfo(currentTask);

    // The style (overdue / today / soon) colors the due text.
    listItem.className = dueInfo.style;

    if (currentTask.done === true) {
      listItem.className = "done";
    }

    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.checked = currentTask.done;

    checkbox.setAttribute(
      "aria-label",
      "Mark " + currentTask.text + " as done",
    );

    checkbox.onchange = function () {
      currentTask.done = checkbox.checked;

      saveData("tasks", todoTasks);

      drawTodo();
    };

    const taskLabel = document.createElement("div");

    taskLabel.className = "grow";
    taskLabel.textContent = currentTask.text;

    // NEW: the due date line under the task text.
    const dueText = document.createElement("small");

    dueText.textContent = dueInfo.text;

    taskLabel.appendChild(dueText);

    const deleteButton = document.createElement("button");

    deleteButton.className = "del";
    deleteButton.textContent = "✕";

    deleteButton.setAttribute("aria-label", "Delete " + currentTask.text);

    deleteButton.onclick = function () {
      todoTasks.splice(todoTasks.indexOf(currentTask), 1);

      saveData("tasks", todoTasks);

      drawTodo();
    };

    listItem.appendChild(checkbox);
    listItem.appendChild(taskLabel);
    listItem.appendChild(deleteButton);

    todoList.appendChild(listItem);
  }

  let remainingTaskCount = 0;

  for (let taskIndex = 0; taskIndex < todoTasks.length; taskIndex++) {
    if (todoTasks[taskIndex].done === false) {
      remainingTaskCount++;
    }
  }

  let taskText = " tasks left";

  if (remainingTaskCount === 1) {
    taskText = " task left";
  }

  getElement("todoCount").textContent = remainingTaskCount + taskText;

  // NEW: refresh the reminder box every time the list is drawn.
  updateReminderBox();
}

// =====================================
// ADD TASK
// =====================================

getElement("todoForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const taskText = getElement("task").value.trim();

  // NEW: read the due date from the date box.
  const dueDateValue = getElement("dueDate").value;

  if (taskText === "") {
    getElement("todoMsg").textContent = "Type a task first.";

    return;
  }

  // NEW: every task needs a due date.
  if (dueDateValue === "") {
    getElement("todoMsg").textContent = "Pick a due date for this task.";

    return;
  }

  // NEW: the date cannot be before today.
  // Dates written as year-month-day can be compared as text.
  if (dueDateValue < getTodayString()) {
    getElement("todoMsg").textContent = "The due date cannot be in the past.";

    return;
  }

  getElement("todoMsg").textContent = "";

  todoTasks.unshift({
    text: taskText,
    done: false,
    dueDate: dueDateValue,
  });

  // NEW: keep the earliest due date at the top.
  sortTasksByDueDate();

  saveData("tasks", todoTasks);

  drawTodo();

  getElement("task").value = "";
  getElement("dueDate").value = "";

  getElement("task").focus();
});

// =====================================
// FILTER BUTTONS
// =====================================

getElement("filters").addEventListener("click", function (event) {
  const selectedFilter = event.target.dataset.f;

  if (!selectedFilter) {
    return;
  }

  currentFilter = selectedFilter;

  const filterButtons = getElement("filters").children;

  for (let buttonIndex = 0; buttonIndex < filterButtons.length; buttonIndex++) {
    const currentButton = filterButtons[buttonIndex];

    if (currentButton.dataset.f === selectedFilter) {
      currentButton.setAttribute("aria-pressed", "true");
    } else {
      currentButton.setAttribute("aria-pressed", "false");
    }
  }

  drawTodo();
});

// =====================================
// CLEAR COMPLETED TASKS
// =====================================

function clearDone() {
  const remainingTasks = [];

  for (let taskIndex = 0; taskIndex < todoTasks.length; taskIndex++) {
    if (todoTasks[taskIndex].done === false) {
      remainingTasks.push(todoTasks[taskIndex]);
    }
  }

  todoTasks = remainingTasks;

  saveData("tasks", todoTasks);

  drawTodo();
}

// =====================================
// START APPLICATION
// =====================================

sortTasksByDueDate();
updateDateLimit();

drawBudget();
drawTodo();

if (location.hash === "#todo") {
  showTab("todo");
} else {
  showTab("budget");
}

window.addEventListener("hashchange", function () {
  if (location.hash === "#todo") {
    showTab("todo");
  } else {
    showTab("budget");
  }
});

// NEW: when the app comes back on screen (for example you reopen the
// phone app the next morning), update the reminders for the new day.
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    updateDateLimit();
    drawTodo();
  }
});

// =====================================
// SERVICE WORKER
// =====================================

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(function () {
    // Ignore registration errors
  });
}
