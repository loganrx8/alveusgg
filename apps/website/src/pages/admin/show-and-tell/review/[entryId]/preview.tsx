import type { InferGetStaticPropsType, NextPage, NextPageContext } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";

import { getAdminSSP } from "@/server/utils/admin";

import { permissions } from "@/data/permissions";

import { trpc } from "@/utils/trpc";

import Heading from "@/components/content/Heading";
import Meta from "@/components/content/Meta";
import Section from "@/components/content/Section";
import { ShowAndTellEntry } from "@/components/show-and-tell/ShowAndTellEntry";

export async function getServerSideProps(context: NextPageContext) {
  const session = await getSession(context);
  const adminProps = await getAdminSSP(context, permissions.manageShowAndTell);
  if (!adminProps) {
    return {
      redirect: {
        destination: session?.user?.id
          ? "/unauthorized"
          : "/auth/signin?callbackUrl=/admin/show-and-tell",
        permanent: false,
      },
    };
  }

  return { props: adminProps };
}

const AdminPreviewShowAndTellPage: NextPage<
  InferGetStaticPropsType<typeof getServerSideProps>
> = () => {
  const router = useRouter();
  const { entryId } = router.query;
  const { data: entry } = trpc.adminShowAndTell.getEntry.useQuery(
    String(entryId),
    { enabled: !!entryId },
  );

  const { data: postsFromANewLocation } =
    trpc.showAndTell.getPostsFromANewLocation.useQuery();

  return (
    <>
      <Meta title="Preview Submission - Show and Tell" />

      {/* Nav background */}
      <div className="-mt-40 hidden h-40 bg-alveus-green-900 lg:block" />

      <Section
        dark
        className="py-12"
        containerClassName="flex flex-wrap gap-4 justify-between"
      >
        <div className="w-full lg:w-3/5">
          <Heading level={1}>Show and Tell</Heading>
        </div>
      </Section>

      {/* Grow the last section to cover the page */}
      <Section className="grow">
        {entry && postsFromANewLocation && (
          <ShowAndTellEntry
            entry={entry}
            newLocation={postsFromANewLocation.has(entry.id)}
            isPresentationView={false}
          />
        )}
      </Section>
    </>
  );
};

export default AdminPreviewShowAndTellPage;
