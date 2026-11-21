# Evolve: Build Habits. Become Better. 

Evolve is a simple habit tracker that runs right in your browser. Tick off your habits each day, plan your to-dos, and watch your progress grow in colourful charts.

**Live demo:** https://ankitpareek-7.github.io/Evolve-Build-Habits-Become-Better/

No sign-up, no install, no server. Open the link and start tracking.

---

## What you can do

### Daily To-Do List
- Add tasks for today and tick them off as you go.
- A progress bar shows how much of the day's list is done.
- Go back to earlier days to see what you completed.
- Removed a task by mistake? Press **Undo**.

### Habit Tracker
- Add habits and choose how often you want to do each one, from **everyday** to **once a week**.
- A monthly grid shows every day. Tick a box when you've done the habit.
- Browse past and future months with **Prev** and **Next**.
- Rename, change the goal, or delete a habit at any time (deleting can be undone too).

### Progress Charts
| Chart | What it tells you |
|---|---|
| **Weekly Progress** | How well you did this week compared with your goal. Use the arrows to check other weeks. |
| **Monthly Progress** | How much of your goal you hit across the whole month. |
| **Consistency** | How steady you've been since you started the habit. |
| **Your Target Streak** | How close you are to your target number of days in a row. Set the target yourself. |

### Streaks that make sense
- For an everyday habit, one missed day breaks the streak.
- For a habit like "3× a week", rest days are fine. You can skip the days you planned to skip and your streak stays alive.

### Three themes
Switch between **Zestia** (dark and neon), **Azura** (light blue) and **Galaxia** (cosmic purple) with the theme switch at the top.

### Nice little touches
- Checkboxes pop and sparkle when you complete something.
- Bars grow smoothly and glow when your progress goes up.
- Works with the keyboard, with a clear focus outline.
- Respects your device's "reduce motion" setting (you still get a gentle glow, just no big movement).
- Works across browser tabs. Change something in one tab and the other updates.

---

## Where is my data saved?

Everything is stored **in your own browser** (using `localStorage`). Nothing is sent anywhere.

That also means:
- Your data stays on the device and browser you used.
- Clearing your browser data will erase your habits and tasks.
- If the saved data ever gets damaged, Evolve keeps whatever is still good, repairs the rest, and stores a backup copy of the original.

---

## Run it on your own computer

Evolve is plain HTML, CSS and JavaScript, with nothing to install or build. It uses JavaScript modules, so open it through a small local server instead of double-clicking `index.html`.

1. Download or clone this repository:
   ```bash
   git clone https://github.com/AnkitPareek-7/Evolve-Track-Your-Journey-To-Better-Self-Habit-Tracker.git
   cd Evolve-Track-Your-Journey-To-Better-Self-Habit-Tracker
   ```
2. Start a local server. Any one of these works:
   ```bash
   # Python
   python -m http.server 8000

   # or Node
   npx serve
   ```
   You can also use the **Live Server** extension in VS Code.
3. Open `http://localhost:8000` in your browser.

---

## Project structure

```
index.html            The page
src/
  js/
    main.js           Starts everything, handles midnight rollover and multi-tab sync
    config.js         Shared settings, helpers and safe storage functions
    habits.js         Habit grid, charts, streaks, edit and delete
    todos.js          Daily to-do list
    theme.js          Theme switching
    effects.js        Undo message and celebration animations
  styles/
    themes.css        Colours for the three themes
    base.css          Page layout, title card, buttons and inputs
    components.css    Grid, charts, to-do list, dialog and animations
```

---

## Built with

- HTML, CSS and vanilla JavaScript (no frameworks, no dependencies)
- Google Fonts: Montserrat and Space Grotesk

---

## Author

Made by [Ankit Pareek](https://github.com/AnkitPareek-7). If you like the project, a star on the repo is always appreciated.

Ideas or bugs? Open an issue and let me know.
