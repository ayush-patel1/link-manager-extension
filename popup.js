class LinksManager {
  constructor() {
    this.links = []
    this.reminders = []
    this.settings = {
      theme: "light",
      enableNotifications: true,
      autoFillForms: true,
      showContextMenu: true,
      defaultCategory: "personal",
    }
    this.stats = {
      totalClicks: 0,
      todayClicks: 0,
      weeklyUsage: Array(7).fill(0),
    }

    this.init()
  }

  async init() {
    await this.loadData()
    this.setupEventListeners()
    this.renderLinks()
    this.renderReminders()
    this.updateStats()
    this.applyTheme()
  }

  async loadData() {
    try {
      const result = await window.chrome.storage.sync.get(["links", "reminders", "settings", "stats"])
      this.links = result.links || []
      this.reminders = result.reminders || []
      this.settings = { ...this.settings, ...result.settings }
      this.stats = { ...this.stats, ...result.stats }
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  async saveData() {
    try {
      await window.chrome.storage.sync.set({
        links: this.links,
        reminders: this.reminders,
        settings: this.settings,
        stats: this.stats,
      })
    } catch (error) {
      console.error("Error saving data:", error)
    }
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchTab(e.target.dataset.tab)
      })
    })

    // Theme toggle
    document.getElementById("themeToggle").addEventListener("click", () => {
      this.toggleTheme()
    })

    // Settings
    document.getElementById("settingsBtn").addEventListener("click", () => {
      this.openSettings()
    })

    document.getElementById("closeSettings").addEventListener("click", () => {
      this.closeSettings()
    })

    document.getElementById("saveSettings").addEventListener("click", () => {
      this.saveSettings()
    })

    // Add this in the setupEventListeners method, after the saveSettings event listener:

    document.getElementById("testNotification").addEventListener("click", async () => {
      try {
        // Test browser notification permission
        if (window.Notification.permission === "default") {
          const permission = await window.Notification.requestPermission()
          if (permission !== "granted") {
            this.showToast("Notification permission denied", "error")
            return
          }
        }

        // Send message to background script to create notification
        window.chrome.runtime.sendMessage({ action: "testNotification" }, (response) => {
          if (response && response.success) {
            this.showToast("Test notification sent!")
          } else {
            this.showToast("Failed to send test notification", "error")
          }
        })
      } catch (error) {
        console.error("Error testing notification:", error)
        this.showToast("Error testing notification", "error")
      }
    })

    // Add link form
    document.getElementById("toggleAddForm").addEventListener("click", () => {
      this.toggleAddForm()
    })

    document.getElementById("addLinkForm").addEventListener("submit", (e) => {
      e.preventDefault()
      this.addLink()
    })

    document.getElementById("cancelAdd").addEventListener("click", () => {
      this.toggleAddForm()
    })

    // Add reminder form
    document.getElementById("toggleReminderForm").addEventListener("click", () => {
      this.toggleReminderForm()
    })

    document.getElementById("addReminderForm").addEventListener("submit", (e) => {
      e.preventDefault()
      this.addReminder()
    })

    document.getElementById("cancelReminder").addEventListener("click", () => {
      this.toggleReminderForm()
    })

    // Search and filter
    document.getElementById("searchInput").addEventListener("input", () => {
      this.filterLinks()
    })

    document.getElementById("categoryFilter").addEventListener("change", () => {
      this.filterLinks()
    })

    // Import/Export
    document.getElementById("exportLinks").addEventListener("click", () => {
      this.exportData()
    })

    document.getElementById("importLinks").addEventListener("click", () => {
      document.getElementById("importFile").click()
    })

    document.getElementById("importFile").addEventListener("change", (e) => {
      this.importData(e.target.files[0])
    })

    // Event delegation for link actions
    document.getElementById("linksList").addEventListener("click", (e) => {
      if (e.target.matches("[data-action]")) {
        const action = e.target.dataset.action
        const id = e.target.dataset.id

        switch (action) {
          case "copy":
            this.copyLink(id)
            break
          case "open":
            this.openLink(id)
            break
          case "edit":
            this.editLink(id)
            break
          case "delete":
            this.deleteLink(id)
            break
        }
      }
    })

    // Event delegation for reminder actions
    document.getElementById("remindersList").addEventListener("click", (e) => {
      if (e.target.matches("[data-action]")) {
        const action = e.target.dataset.action
        const id = e.target.dataset.id

        switch (action) {
          case "complete":
            this.completeReminder(id)
            break
          case "delete-reminder":
            this.deleteReminder(id)
            break
        }
      }
    })
  }
}