class BackgroundManager {
  constructor() {
    this.init()
  }

  init() {
    this.setupAlarmListener()
    this.setupContextMenu()
    this.setupInstallListener()
    this.setupCommandListener()
    this.setupNotificationListener()
  }

  setupAlarmListener() {
    window.chrome.alarms.onAlarm.addListener(async (alarm) => {
      console.log("Alarm triggered:", alarm.name)
      try {
        const result = await window.chrome.storage.sync.get(["reminders", "settings"])
        const reminders = result.reminders || []
        const settings = result.settings || { enableNotifications: true }

        const reminder = reminders.find((r) => r.id === alarm.name)
        console.log("Found reminder:", reminder)

        if (reminder && !reminder.completed) {
          if (settings.enableNotifications) {
            await this.showNotification(reminder)
          }

          // Mark reminder as completed
          const updatedReminders = reminders.map((r) => (r.id === reminder.id ? { ...r, completed: true } : r))
          await window.chrome.storage.sync.set({ reminders: updatedReminders })
        }
      } catch (error) {
        console.error("Error handling alarm:", error)
      }
    })
  }

  setupContextMenu() {
    window.chrome.runtime.onInstalled.addListener(() => {
      window.chrome.contextMenus.create({
        id: "addToLinksPlus",
        title: "Add to Links++",
        contexts: ["link", "page"],
      })

      window.chrome.contextMenus.create({
        id: "openLinksPlus",
        title: "Open Links++",
        contexts: ["all"],
      })
    })

    window.chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId === "addToLinksPlus") {
        const url = info.linkUrl || info.pageUrl
        const title = info.selectionText || tab.title
        await this.addLinkFromContext(url, title)
      } else if (info.menuItemId === "openLinksPlus") {
        window.chrome.action.openPopup()
      }
    })
  }

  setupInstallListener() {
    window.chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.showWelcomeNotification()
      }
    })
  }

  setupCommandListener() {
    window.chrome.commands.onCommand.addListener((command) => {
      if (command === "open-popup") {
        window.chrome.action.openPopup()
      }
    })
  }

  setupNotificationListener() {
    // Handle notification clicks
    window.chrome.notifications.onClicked.addListener((notificationId) => {
      window.chrome.action.openPopup()
      window.chrome.notifications.clear(notificationId)
    })

    // Handle notification button clicks
    window.chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
      if (buttonIndex === 0) {
        // Complete button
        try {
          const result = await window.chrome.storage.sync.get(["reminders"])
          const reminders = result.reminders || []
          const updatedReminders = reminders.map((r) => (r.id === notificationId ? { ...r, completed: true } : r))
          await window.chrome.storage.sync.set({ reminders: updatedReminders })
          window.chrome.notifications.clear(notificationId)
        } catch (error) {
          console.error("Error completing reminder:", error)
        }
      }
    })
  }

  async addLinkFromContext(url, title) {
    try {
      const result = await window.chrome.storage.sync.get(["links"])
      const links = result.links || []

      const newLink = {
        id: Date.now().toString(),
        title: title.substring(0, 100), // Limit title length
        url: url,
        category: "other",
        description: "Added from context menu",
        createdAt: new Date().toISOString(),
        clickCount: 0,
      }

      links.unshift(newLink)
      await window.chrome.storage.sync.set({ links })

      await this.showSimpleNotification({
        title: "Link Added!",
        message: `"${title}" has been added to Links++`,
      })
    } catch (error) {
      console.error("Error adding link from context:", error)
    }
  }

  async showNotification(reminder) {
    const options = {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: `⏰ Reminder: ${reminder.title}`,
      message: reminder.description || "You have a reminder!",
      priority: reminder.priority === "high" ? 2 : 1,
      requireInteraction: reminder.priority === "high",
      buttons: [{ title: "Mark Complete" }, { title: "Dismiss" }],
    }

    try {
      await window.chrome.notifications.create(reminder.id, options)
      console.log("Notification created for reminder:", reminder.title)

      // Auto-clear notification after 30 seconds for non-high priority
      if (reminder.priority !== "high") {
        setTimeout(() => {
          window.chrome.notifications.clear(reminder.id)
        }, 30000)
      }
    } catch (error) {
      console.error("Error creating notification:", error)
    }
  }

  async showSimpleNotification({ title, message }) {
    try {
      await window.chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: title,
        message: message,
      })
    } catch (error) {
      console.error("Error showing notification:", error)
    }
  }

  showWelcomeNotification() {
    window.chrome.notifications.create("welcome", {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Welcome to Links++!",
      message: "Your smart link manager is ready to use. Click the extension icon to get started!",
    })
  }
}

// Initialize background manager
new BackgroundManager()

// Handle extension icon click
window.chrome.action.onClicked.addListener(() => {
  window.chrome.action.openPopup()
})

// Message handling for content script communication
window.chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLinks") {
    window.chrome.storage.sync.get(["links"]).then((result) => {
      sendResponse({ links: result.links || [] })
    })
    return true // Keep message channel open for async response
  }

  if (request.action === "addLink") {
    window.chrome.storage.sync.get(["links"]).then(async (result) => {
      const links = result.links || []
      links.unshift(request.link)
      await window.chrome.storage.sync.set({ links })
      sendResponse({ success: true })
    })
    return true
  }

  if (request.action === "testNotification") {
    window.chrome.notifications.create("test", {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Test Notification",
      message: "This is a test notification from Links++!",
    })
    sendResponse({ success: true })
    return true
  }
})
