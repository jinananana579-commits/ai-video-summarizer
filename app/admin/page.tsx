import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

// @ts-ignore
const prisma = new PrismaClient();

async function addCredits(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const amount = parseInt(formData.get("amount") as string);
  
  if (userId && !isNaN(amount)) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        credits: { increment: amount }
      }
    });
    revalidatePath("/admin");
  }
}

async function extendSubscription(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const now = new Date();
      const currentEnd = user.subscriptionEnd && user.subscriptionEnd > now ? user.subscriptionEnd : now;
      const newEnd = new Date(currentEnd);
      newEnd.setMonth(newEnd.getMonth() + 1); // Add 1 month
      
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionEnd: newEnd }
      });
      revalidatePath("/admin");
    }
  }
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  
  // @ts-ignore
  if (!session || session?.user?.role !== "ADMIN") {
    redirect("/"); // Redirect non-admins
  }

  const users = await prisma.user.findMany({
    orderBy: { email: 'asc' }
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      
      <div className="bg-gray-800 rounded-xl p-6 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="p-3 text-gray-400">Email</th>
              <th className="p-3 text-gray-400">Role</th>
              <th className="p-3 text-gray-400">Credits</th>
              <th className="p-3 text-gray-400">Subscription Ends</th>
              <th className="p-3 text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                <td className="p-3">{user.email || 'No email'}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${user.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-3 font-mono font-bold text-green-400">{user.credits}</td>
                <td className="p-3">
                  {user.subscriptionEnd 
                    ? new Date(user.subscriptionEnd).toLocaleDateString() 
                    : <span className="text-gray-500">None</span>}
                </td>
                <td className="p-3 flex gap-2">
                  <form action={addCredits} className="flex gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <input 
                      type="number" 
                      name="amount" 
                      defaultValue="10" 
                      className="w-16 bg-gray-900 border border-gray-700 rounded px-2 text-sm"
                    />
                    <button type="submit" className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm transition-colors">
                      Add
                    </button>
                  </form>
                  <form action={extendSubscription}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition-colors">
                      +1 Month
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
