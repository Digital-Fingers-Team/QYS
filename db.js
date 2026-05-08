// db.js - Central Database Configuration using Dexie.js
const db = new Dexie("YouthSportsPlatformDB");

// Define Database Schema
db.version(5).stores({
    users: "++id, email, password, role, name, points, createdAt, status, avatar, language, theme",
    sessions: "++id, userId, token, expiresAt",
    centers: "++id, name, location, capacity, rating, type, image, description",
    challenges: "++id, title, description, reward, status, category, participants, maxParticipants, deadline, createdAt",
    userChallenges: "++id, userId, challengeId, joinedAt, completed, pointsEarned",
    ideas: "++id, userId, userName, title, description, status, votes, createdAt",
    complaints: "++id, userId, userName, title, description, status, createdAt, type",
    reports: "++id, type, title, content, date, status",
    activities: "++id, action, userId, userName, timestamp"
});

// Seed Initial Data if Database is Empty
async function seedDatabase() {
    try {
        const userCount = await db.users.count();
        if (userCount === 0) {
            await db.users.bulkAdd([
                { email: "user@example.com", password: "user123", role: "user", name: "مستخدم تجريبي", points: 150, createdAt: new Date() },
                { email: "admin@example.com", password: "admin123", role: "admin", name: "مدير النظام", points: 0, createdAt: new Date() }
            ]);
            console.log("✅ Seeded users");
        }
        
        const challengeCount = await db.challenges.count();
        if (challengeCount === 0) {
            await db.challenges.bulkAdd([
                { title: "تحدي اللياقة البدنية", description: "مارس الرياضة لمدة 30 دقيقة يومياً لمدة أسبوع", reward: 100, status: "نشط", category: "fitness", participants: 15, deadline: "2026-06-01" },
                { title: "بطولة الشطرنج الرمضانية", description: "شارك في بطولة الشطرنج السنوية بمركز شباب بنها", reward: 500, status: "نشط", category: "mental", participants: 40, deadline: "2026-05-15" },
                { title: "ماراثون القليوبية للجري", description: "ماراثون 5 كم في شوارع مدينة بنها", reward: 300, status: "قريباً", category: "running", participants: 0, deadline: "2026-07-10" }
            ]);
            console.log("✅ Seeded challenges");
        }

        const centerCount = await db.centers.count();
        if (centerCount < 70) {
            await db.centers.clear(); // Clear existing to ensure full updated list
            await db.centers.bulkAdd([
                { name: "مركز شباب إمياي", location: "طوخ", rating: 4.5, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب متميز في طوخ" },
                { name: "مركز شباب السيفا", location: "طوخ", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "يقدم أنشطة رياضية متنوعة" },
                { name: "مركز شباب طنط الجزيرة", location: "طوخ", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب نشط في طوخ" },
                { name: "مركز شباب المنيرة", location: "القناطر الخيرية", rating: 4.6, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "من أهم مراكز القناطر" },
                { name: "مركز شباب برشوم الكبرى", location: "طوخ", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب عريق في طوخ" },
                { name: "مركز شباب العمار", location: "طوخ", rating: 4.4, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "أنشطة رياضية وثقافية" },
                { name: "مركز شباب شبرا شهاب", location: "القناطر الخيرية", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "خدمة متميزة للشباب" },
                { name: "مركز شباب أجهور الصغرى", location: "القناطر الخيرية", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "مركز شباب متطور" },
                { name: "مركز شباب الوقف", location: "شبين القناطر", rating: 4.0, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "أنشطة متنوعة في شبين القناطر" },
                { name: "مركز شباب بهادة", location: "القناطر الخيرية", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "مركز شباب القناطر" },
                { name: "مركز شباب البرادعة", location: "القناطر الخيرية", rating: 4.5, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب نموذجي" },
                { name: "مركز شباب صنافير", location: "قليوب", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "أنشطة رياضية في قليوب" },
                { name: "مركز شباب حلابة", location: "قليوب", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب نشط في قليوب" },
                { name: "مركز شباب قلما", location: "قليوب", rating: 4.4, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "خدمات متميزة في قليوب" },
                { name: "مركز شباب كفر بطا", location: "بنها", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب في بنها" },
                { name: "مركز شباب طحلة", location: "بنها", rating: 4.5, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "أنشطة رياضية متنوعة في بنها" },
                { name: "مركز شباب شبلنجة", location: "بنها", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب شبلنجة في بنها" },
                { name: "مركز شباب جمجرة الجديدة", location: "بنها", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "تطوير مستمر في بنها" },
                { name: "مركز شباب جمجرة الكبرى", location: "بنها", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "أنشطة ثقافية ورياضية في بنها" },
                { name: "مركز شباب كفر الجزار", location: "بنها", rating: 4.6, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "من أهم مراكز بنها" },
                { name: "مركز شباب نقباس", location: "بنها", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب متميز في بنها" },
                { name: "مركز شباب منية السباع", location: "بنها", rating: 4.0, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "خدمات شبابية في بنها" },
                { name: "مركز شباب الرملة", location: "بنها", rating: 4.4, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب الرملة في بنها" },
                { name: "مركز شباب المنشية", location: "بنها", rating: 4.5, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "أنشطة متنوعة في بنها" },
                { name: "مركز شباب بطا", location: "بنها", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب بطا في بنها" },
                { name: "مركز شباب كفر الشيخ إبراهيم", location: "بنها", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "خدمة متميزة في بنها" },
                { name: "مركز شباب بتمدة", location: "بنها", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب بتمدة في بنها" },
                { name: "مركز شباب جزيرة بلي", location: "بنها", rating: 4.4, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "أنشطة رياضية في بنها" },
                { name: "مركز شباب ميت الحوفيين", location: "بنها", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب ميت الحوفيين في بنها" },
                { name: "مركز شباب سندنهور", location: "بنها", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "خدمات شبابية في بنها" },
                { name: "مركز شباب فرسيس", location: "بنها", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب فرسيس في بنها" },
                { name: "مركز شباب عزبة نجيب", location: "بنها", rating: 4.0, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "تطوير مستمر في بنها" },
                { name: "مركز شباب كفر طحلة", location: "بنها", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "أنشطة رياضية في بنها" },
                { name: "مركز شباب كفر أبو ذكري", location: "بنها", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "مركز شباب كفر أبو ذكري في بنها" },
                { name: "مركز شباب كفر الأربعين", location: "بنها", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "خدمات متميزة في بنها" },
                { name: "مركز شباب منشأة دياب", location: "بنها", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "مركز شباب منشأة دياب في بنها" },
                { name: "مركز شباب كفر العرب", location: "بنها", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "أنشطة متنوعة في بنها" },
                { name: "مركز شباب الحسانية", location: "طوخ", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "مركز شباب الحسانية في طوخ" },
                { name: "مركز شباب شبرا هارس", location: "طوخ", rating: 4.4, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "خدمات شبابية في طوخ" },
                { name: "مركز شباب الناصرية", location: "القناطر الخيرية", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "مركز شباب الناصرية في القناطر" },
                { name: "مركز شباب كفر الحدادين", location: "طوخ", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "أنشطة رياضية في طوخ" },
                { name: "مركز شباب كفر علوان", location: "قليوب", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "مركز شباب كفر علوان في قليوب" },
                { name: "مركز شباب نامول", location: "طوخ", rating: 4.4, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "خدمات متميزة في طوخ" },
                { name: "مركز شباب الدير", location: "طوخ", rating: 4.5, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "من أهم مراكز طوخ" },
                { name: "مركز شباب الصفا", location: "شبين القناطر", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب الصفا في شبين القناطر" },
                { name: "مركز شباب الصالحية", location: "شبين القناطر", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "أنشطة متنوعة في شبين القناطر" },
                { name: "مركز شباب كفر العمار", location: "طوخ", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب كفر العمار في طوخ" },
                { name: "مركز شباب كفر الجمال", location: "طوخ", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "خدمة متميزة في طوخ" },
                { name: "مركز شباب سندوة", location: "الخانكة", rating: 4.4, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب سندوة في الخانكة" },
                { name: "مركز شباب سرياقوس", location: "الخانكة", rating: 4.5, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "أنشطة رياضية كبيرة في الخانكة" },
                { name: "مركز شباب كفر الربعيين", location: "شبين القناطر", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب كفر الربعيين في شبين" },
                { name: "مركز شباب 24 يوليو", location: "شبين القناطر", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "أنشطة متميزة في شبين القناطر" },
                { name: "مركز شباب كفر حمزة", location: "الخانكة", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب كفر حمزة في الخانكة" },
                { name: "مركز شباب الشقر", location: "كفر شكر", rating: 4.4, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "مركز شباب الشقر في كفر شكر" },
                { name: "مركز شباب كفر عامر", location: "بنها", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "أنشطة متنوعة في بنها" },
                { name: "مركز شباب كفر عزب غنيم", location: "القناطر الخيرية", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "مركز شباب كفر عزب غنيم في القناطر" },
                { name: "مركز شباب كفر الولجا", location: "كفر شكر", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب كفر الولجا في كفر شكر" },
                { name: "مركز شباب كفر رجب", location: "شبين القناطر", rating: 4.4, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "أنشطة رياضية في شبين" },
                { name: "مركز شباب كفر الحبش", location: "شبين القناطر", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب كفر الحبش في شبين" },
                { name: "مركز شباب زاوية النجار", location: "قليوب", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "مركز شباب زاوية النجار في قليوب" },
                { name: "مركز شباب كفر الدير", location: "طوخ", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب كفر الدير في طوخ" },
                { name: "مركز شباب الشيخة سالمة", location: "شبين القناطر", rating: 4.4, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "أنشطة متميزة في شبين" },
                { name: "مركز شباب الشيخ سند", location: "قليوب", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "مركز شباب الشيخ سند في قليوب" },
                { name: "مركز شباب القلزم", location: "قليوب", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "مركز شباب القلزم في قليوب" },
                { name: "مركز شباب كفر طحوريا", location: "شبين القناطر", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "خدمات شبابية في شبين" },
                { name: "مركز شباب الجبلاوي وعمر", location: "شبين القناطر", rating: 4.4, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "مركز شباب متميز في شبين" },
                { name: "مركز شباب الحرية والسماع", location: "شبين القناطر", rating: 4.1, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "أنشطة متنوعة في شبين" },
                { name: "مركز شباب سندبيس", location: "القناطر الخيرية", rating: 4.3, type: "مركز شباب", image: "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800", description: "مركز شباب سندبيس في القناطر" },
                { name: "مركز شباب قرنفيل", location: "القناطر الخيرية", rating: 4.5, type: "مركز شباب", image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800", description: "من أهم مراكز القناطر" },
                { name: "مركز شباب شلقان", location: "القناطر الخيرية", rating: 4.2, type: "مركز شباب", image: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800", description: "مركز شباب شلقان في القناطر" }
            ]);
            console.log("✅ Seeded centers");
        }

        const ideasCount = await db.ideas.count();
        if (ideasCount === 0) {
            await db.ideas.bulkAdd([
                { userId: 1, userName: "مستخدم تجريبي", title: "تطوير ملاعب التنس", description: "نقترح إضافة ملاعب تنس جديدة في مركز شباب بنها", status: "تحت الدراسة", votes: 25, createdAt: new Date() },
                { userId: 1, userName: "مستخدم تجريبي", title: "تطبيق للمسابقات", description: "إنشاء تطبيق خاص للمسابقات الرياضية بين مراكز المحافظة", status: "مقبولة", votes: 42, createdAt: new Date() }
            ]);
            console.log("✅ Seeded ideas");
        }

        const complaintsCount = await db.complaints.count();
        if (complaintsCount === 0) {
            await db.complaints.bulkAdd([
                { userId: 1, userName: "مستخدم تجريبي", title: "صيانة الإنارة", description: "الإنارة في الملعب الخماسي تحتاج لصيانة", status: "قيد المعالجة", createdAt: new Date(), type: "صيانة" }
            ]);
            console.log("✅ Seeded complaints");
        }
    } catch (error) {
        console.error("❌ Error seeding database:", error);
    }
}

// Global helper functions
window.getLoggedInUser = async () => {
    const session = JSON.parse(localStorage.getItem('session') || sessionStorage.getItem('session') || 'null');
    if (!session || !session.loggedIn) return null;
    
    // Check if session is expired
    if (new Date().getTime() > session.expiresAt) {
        localStorage.removeItem('session');
        sessionStorage.removeItem('session');
        return null;
    }
    
    return await db.users.get(session.userId);
};

window.logout = () => {
    localStorage.removeItem('session');
    sessionStorage.removeItem('session');
    window.location.href = 'index.html';
};

// Initialize
db.open().catch(err => {
    console.error("Failed to open db: " + (err.stack || err));
});
seedDatabase();
