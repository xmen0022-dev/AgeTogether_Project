let dataIdSeed = 1000;
const dataNextId = () => dataIdSeed++;

window.appData = {
  nextIdStart: 2000,
  colors: ["peach", "purple", "blue", "green"],
  state: {
    familyMembers: [
      { id: 1, initial: "D", name: "Daniel", rel: "Son", contact: "daniel@email.com", color: "peach", muted: false },
      { id: 2, initial: "S", name: "Sophie", rel: "Granddaughter", contact: "0412 345 678", color: "purple", muted: false },
      { id: 3, initial: "L", name: "Linda", rel: "Daughter", contact: "linda@email.com", color: "blue", muted: false },
      { id: 4, initial: "J", name: "James", rel: "Carer", contact: "0498 765 432", color: "green", muted: false },
    ],
    familyNotes: [
      { id: dataNextId(), memberId: 1, text: "Doctor appointment on Friday at 2 pm &#x1FA7A;", date: "18 Aug", done: false },
      { id: dataNextId(), memberId: 2, text: "Remember to drink water today &#x1F4A7;", date: "18 Aug", done: false },
      { id: dataNextId(), memberId: 3, text: "I will call tonight after dinner &#x1F4DE;", date: "18 Aug", done: true },
      { id: dataNextId(), memberId: 4, text: "Medication checked &#x2713;", date: "18 Aug", done: true },
      { id: dataNextId(), memberId: 2, text: "Let's have lunch this weekend! &#x1F37D;", date: "17 Aug", done: false },
      { id: dataNextId(), memberId: 1, text: "Your favourite show is on at 7 pm tonight &#x1F4FA;", date: "17 Aug", done: false },
    ],
    familyFilterId: null,
    familyNotePickId: 1,

    friends: [
      { id: 1, initial: "M", name: "Margaret", color: "peach", contact: "Connected via Email invite", muted: false },
      { id: 2, initial: "D", name: "David", color: "blue", contact: "Connected via Phone invite", muted: false },
      { id: 3, initial: "H", name: "Helen", color: "purple", contact: "Connected via Invitation code", muted: false },
    ],
    friendNotes: {
      1: [
        { id: dataNextId(), author: "friend", color: "peach", text: "Good morning! I hope you are having a lovely peaceful day &#x2600;", date: "18 Aug" },
        { id: dataNextId(), author: "you", color: "green", text: "Good morning Margaret! The garden is looking beautiful today.", date: "18 Aug" },
        { id: dataNextId(), author: "friend", color: "yellow", text: "Would you like to walk together this weekend? I know a lovely path by the lake.", date: "17 Aug" },
        { id: dataNextId(), author: "you", color: "blue", text: "Yes, that sounds lovely. Saturday morning would be perfect!", date: "17 Aug" },
        { id: dataNextId(), author: "friend", color: "peach", text: "Wonderful! I will bring some homemade biscuits to share &#x1F36A;", date: "17 Aug" },
      ],
      2: [],
      3: [],
    },
    selectedFriendId: 1,

    activities: [
      { id: dataNextId(), category: "Walking", icon: "&#x1F6B6;", title: "Morning Walk at Carlton Gardens", location: "Carlton Gardens, Melbourne &middot; 1.2 km away", date: "Wednesday, 20 Aug &middot; 8:00 am", price: "Free", copy: "A friendly guided morning walk through the gardens. All fitness levels welcome. Walking poles provided.", access: "Flat paths, wheelchair accessible", organiser: "Melbourne City Council", saved: false, joined: false },
      { id: dataNextId(), category: "Gardening", icon: "&#x1F331;", title: "Community Gardening Group", location: "Fitzroy Community Garden &middot; 2.4 km away", date: "Saturday, 23 Aug &middot; 10:00 am", price: "Free", copy: "Grow vegetables and flowers with friendly neighbours. No experience needed - tools and gloves provided.", access: "Ground level, seated options available", organiser: "Fitzroy Community Hub", saved: false, joined: false },
      { id: dataNextId(), category: "Library event", icon: "&#x1F4BB;", title: "Library Digital Skills Workshop", location: "Melbourne City Library &middot; 0.9 km away", date: "Thursday, 21 Aug &middot; 2:00 pm", price: "Free", copy: "Learn how to use your phone and tablet safely. Friendly staff help at your own pace. Bring your device.", access: "Fully accessible, lift available", organiser: "State Library Victoria", saved: false, joined: false },
      { id: dataNextId(), category: "Coffee group", icon: "&#x2615;", title: "Seniors Coffee Morning", location: "Brunswick Community Centre &middot; 3.1 km away", date: "Friday, 22 Aug &middot; 10:30 am", price: "Low cost - $3 donation", copy: "A warm and welcoming morning tea with other seniors. Chat, play cards, or simply enjoy the company.", access: "Accessible entrance, seating provided", organiser: "Brunswick Seniors Network", saved: false, joined: false },
      { id: dataNextId(), category: "Health workshop", icon: "&#x1F938;", title: "Gentle Exercise Class", location: "Northcote Leisure Centre &middot; 4.0 km away", date: "Tuesday & Friday &middot; 9:30 am", price: "Low cost - $5 per session", copy: "Low-impact stretching and gentle movement for older adults. Instructor led, suitable for all abilities.", access: "Accessible venue, chairs available", organiser: "Northcote Leisure Centre", saved: false, joined: false },
    ],
    activityFilter: "All",

    newsItems: [
      { id: dataNextId(), icon: "&#x1F9E0;", tag: "Healthy Ageing", title: "Staying socially connected helps protect brain health", copy: "New research shows that regular contact with friends and family can significantly reduce the risk of cognitive decline in older adults.", source: "Australian Institute of Health and Welfare", saved: false },
      { id: dataNextId(), icon: "&#x1F6E1;", tag: "Scam Safety", title: "New phone scam targeting older Australians - what to know", copy: "Scammers are pretending to be from Medicare. They will never call you asking for personal details. Hang up and call the official number.", source: "Scamwatch Australia", saved: false },
      { id: dataNextId(), icon: "&#x1F91D;", tag: "Local Community", title: "Free community programs available across Victoria this August", copy: "Local councils are offering free social events, exercise classes, and digital skills workshops for seniors throughout August and September.", source: "Victorian Seniors Festival", saved: false },
    ],

    profile: {
      fullName: "Margaret Lee",
      preferredName: "Margaret",
      age: "71",
      phone: "0412 345 678",
      email: "margaret.lee@email.com",
      suburb: "Carlton, VIC",
      emergencyContact: "Daniel Lee - 0423 456 789",
      accessibility: "Prefer seating. Hearing aid user.",
    },
    profileJustSaved: false,
    profileToggles: [
      { key: "showName", title: "Show my name", copy: "Your preferred name will be shown.", on: true },
      { key: "showPhone", title: "Show my phone number", copy: "Your phone number may be given to the organiser.", on: false },
      { key: "showEmail", title: "Show my email address", copy: "Your email may be given to the organiser.", on: true },
      { key: "showSuburb", title: "Show my suburb", copy: "Helps organisers suggest nearby activities.", on: true },
      { key: "shareAccessibility", title: "Share accessibility needs with activity organisers", copy: "Helps organisers prepare appropriate support.", on: true },
      { key: "shareEmergency", title: "Share emergency contact only when needed", copy: "Only shared in an emergency situation.", on: false },
    ],
  },
};
