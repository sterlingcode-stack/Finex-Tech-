/* =====================================
   FINEX — SAVE · PAY · GROW
   Frontend Prototype JavaScript
   ===================================== */

document.addEventListener("DOMContentLoaded", () => {

  // FINEX demo wallet
  let balance = 125000;

  let transactions = [
    {
      name: "Welcome Bonus",
      type: "Credit",
      amount: 50000,
      date: "Today"
    },
    {
      name: "Wallet Funding",
      type: "Credit",
      amount: 75000,
      date: "Today"
    }
  ];

  // Currency formatter
  const formatMoney = (amount) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 2
    }).format(amount);

  // Display wallet balance
  function updateBalance() {
    const balanceElement =
      document.getElementById("balanceAmount");

    if (balanceElement) {
      balanceElement.textContent = formatMoney(balance);
    }
  }

  updateBalance();

  // Show and hide wallet balance
  const toggleBalance =
    document.getElementById("toggleBalance");

  let balanceVisible = true;

  if (toggleBalance) {
    toggleBalance.addEventListener("click", () => {
      balanceVisible = !balanceVisible;

      const balanceElement =
        document.getElementById("balanceAmount");

      if (balanceElement) {
        balanceElement.textContent = balanceVisible
          ? formatMoney(balance)
          : "₦ •••••••";
      }
    });
  }

  // Notifications
  function notify(message) {
    let notification =
      document.getElementById("finexNotification");

    if (!notification) {
      notification = document.createElement("div");
      notification.id = "finexNotification";
      document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.classList.add("show");

    setTimeout(() => {
      notification.classList.remove("show");
    }, 3000);
  }

  // Transaction history
  function displayTransactions() {
    const transactionList =
      document.getElementById("transactionList");

    if (!transactionList) return;

    transactionList.innerHTML = "";

    transactions.forEach((transaction) => {

      const item = document.createElement("div");
      item.className = "transaction-item";

      const name = document.createElement("span");
      name.textContent = transaction.name;

      const details = document.createElement("small");
      details.textContent =
        transaction.type + " • " + transaction.date;

      const amount = document.createElement("strong");
      amount.textContent =
        (transaction.type === "Credit" ? "+" : "-") +
        formatMoney(transaction.amount);

      item.append(name, details, amount);
      transactionList.appendChild(item);

    });
  }

  displayTransactions();

  // Demo deposit
  function deposit(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Enter a valid deposit amount.");
      return;
    }

    notify(
      "Demo only: Connect a verified payment provider to fund this wallet."
    );
  }

  // Demo transfer
  function transfer(amount, account) {
    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Enter a valid transfer amount.");
      return;
    }

    if (!account || !account.trim()) {
      notify("Enter a recipient account.");
      return;
    }

    notify(
      "Demo only: Real transfers are not enabled."
    );
  }

  // Demo bill payment
  function payBill(biller, amount) {
    if (!biller || !Number.isFinite(amount) || amount <= 0) {
      notify("Enter valid bill payment details.");
      return;
    }

    notify(
      "Demo only: Bill payment integration is not enabled."
    );
  }

  // Dashboard navigation
  document.querySelectorAll("[data-tab]").forEach(button => {

    button.addEventListener("click", () => {

      const selectedTab = button.dataset.tab;

      document.querySelectorAll(".dashboard-section")
        .forEach(section => {
          section.hidden =
            section.id !== selectedTab;
        });

      document.querySelectorAll("[data-tab]")
        .forEach(tab => {
          tab.classList.remove("active");
        });

      button.classList.add("active");

    });

  });

  // Action buttons
  document.querySelectorAll("[data-action]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const action = button.dataset.action;

        if (action === "deposit") {
          notify("Deposit section selected.");
        }

        if (action === "transfer") {
          notify("Transfer section selected.");
        }

        if (action === "bills") {
          notify("Bill payments section selected.");
        }

        if (action === "history") {
          notify("Transaction history selected.");
        }

      });

    });

  // Current date
  const dateElement =
    document.getElementById("currentDate");

  if (dateElement) {
    dateElement.textContent =
      new Date().toLocaleDateString("en-NG", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
  }

  // Make demo functions available to HTML
  window.FINEX = {
    deposit,
    transfer,
    payBill,
    notify,
    formatMoney
  };

  console.log("FINEX initialized successfully.");

});

